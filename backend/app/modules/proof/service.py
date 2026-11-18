import calendar
from datetime import date, datetime, time, timedelta, timezone
import re
import threading
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ...models import User, now_utc
from .models import (
    ProofAuditLog,
    ProofBusiness,
    ProofCustomer,
    ProofDelivery,
    ProofReceipt,
    ProofReceiptItem,
)
from .schemas import (
    BusinessResponse,
    BusinessUpdateRequest,
    CustomerResponse,
    CustomerUpsertRequest,
    DeliveryCreateRequest,
    DeliveryResponse,
    PaginatedCustomersResponse,
    PaginatedReceiptsResponse,
    ReceiptCreateRequest,
    ReceiptItemResponse,
    ReceiptResponse,
    ReceiptVoidRequest,
    ReportDayPoint,
    ReportPeriod,
    ReportSummaryResponse,
    SyncReceiptResultItem,
    SyncReceiptsResponse,
    VerifyReceiptItemResponse,
    VerifyReceiptResponse,
)
from .utils import (
    compute_content_hash,
    compute_receipt_totals,
    format_receipt_number,
    generate_public_code,
    normalize_utc,
    verify_content_hash,
)

_sqlite_seq_lock = threading.Lock()
PUBLIC_CODE_RE = re.compile(r"^[A-Z0-9]{8}$")


class ProofError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers


def _is_postgres(db: Session) -> bool:
    bind = db.get_bind()
    return bool(bind and bind.dialect.name.startswith("postgresql"))


def get_or_create_business(db: Session, user: User) -> ProofBusiness:
    business = db.scalar(
        select(ProofBusiness).where(ProofBusiness.owner_user_id == user.id)
    )
    if business is not None:
        return business

    default_name = "My Business"
    default_phone = user.phone or ""
    default_address = ""

    if user.business is not None:
        if user.business.business_name:
            default_name = user.business.business_name.strip()[:160]
        if user.business.phone:
            default_phone = user.business.phone.strip()[:20]
        if user.business.address:
            default_address = user.business.address.strip()[:255]
    else:
        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        if full_name:
            default_name = f"{full_name} Business"[:160]

    business = ProofBusiness(
        owner_user_id=user.id,
        name=default_name,
        phone=default_phone,
        email="",
        address=default_address,
        logo_data="",
        receipt_prefix="OP",
        next_seq=1,
    )
    try:
        with db.begin_nested():
            db.add(business)
            db.flush()
        db.commit()
        db.refresh(business)
        return business
    except IntegrityError:
        existing = db.scalar(
            select(ProofBusiness).where(ProofBusiness.owner_user_id == user.id)
        )
        if existing is not None:
            return existing
        raise


def _allocate_receipt_number(
    db: Session,
    business_id: str,
    issued_at: datetime,
) -> str:
    if _is_postgres(db):
        locked_business = db.scalar(
            select(ProofBusiness)
            .where(ProofBusiness.id == business_id)
            .with_for_update()
        )
        if locked_business is None:
            raise ProofError(404, "BUSINESS_NOT_FOUND", "Business not found.")
        seq = locked_business.next_seq
        number = format_receipt_number(
            locked_business.receipt_prefix,
            issued_at,
            seq,
        )
        locked_business.next_seq = seq + 1
        db.flush()
        return number

    with _sqlite_seq_lock:
        locked_business = db.scalar(
            select(ProofBusiness).where(ProofBusiness.id == business_id)
        )
        if locked_business is None:
            raise ProofError(404, "BUSINESS_NOT_FOUND", "Business not found.")
        seq = locked_business.next_seq
        number = format_receipt_number(
            locked_business.receipt_prefix,
            issued_at,
            seq,
        )
        locked_business.next_seq = seq + 1
        db.flush()
        return number


def _allocate_public_code(db: Session) -> str:
    for _ in range(5):
        candidate = generate_public_code()
        exists = db.scalar(
            select(ProofReceipt.id).where(ProofReceipt.public_code == candidate)
        )
        if not exists:
            return candidate
    raise ProofError(
        503,
        "PUBLIC_CODE_EXHAUSTED",
        "Unable to generate a unique public verification code. Please retry.",
    )


def _upsert_customer_on_receipt(
    db: Session,
    business_id: str,
    customer_name: str,
    customer_phone: str,
    customer_email: str,
) -> None:
    clean_phone = (customer_phone or "").strip()
    if not clean_phone:
        return

    existing = db.scalar(
        select(ProofCustomer).where(
            ProofCustomer.business_id == business_id,
            ProofCustomer.phone == clean_phone,
        )
    )
    if existing is not None:
        existing.name = customer_name
        if customer_email:
            existing.email = customer_email
        db.flush()
    else:
        customer = ProofCustomer(
            business_id=business_id,
            name=customer_name,
            phone=clean_phone,
            email=customer_email or "",
        )
        db.add(customer)
        db.flush()


def serialize_receipt(
    receipt: ProofReceipt,
    sync_status: str | None = None,
) -> ReceiptResponse:
    items_resp = [
        ReceiptItemResponse(
            id=item.id,
            position=item.position,
            description=item.description,
            serial_number=item.serial_number or "",
            quantity=item.quantity,
            unit_price_kobo=item.unit_price_kobo,
            line_total_kobo=item.line_total_kobo,
        )
        for item in sorted(receipt.items, key=lambda x: x.position)
    ]
    deliveries_resp = [
        DeliveryResponse(
            id=d.id,
            receipt_id=d.receipt_id,
            channel=d.channel,  # type: ignore[arg-type]
            created_at=normalize_utc(d.created_at),
        )
        for d in sorted(receipt.deliveries, key=lambda x: x.created_at)
    ]
    return ReceiptResponse(
        id=receipt.id,
        business_id=receipt.business_id,
        number=receipt.number,
        public_code=receipt.public_code,
        record_type=receipt.record_type,  # type: ignore[arg-type]
        customer_name=receipt.customer_name,
        customer_phone=receipt.customer_phone or "",
        customer_email=receipt.customer_email or "",
        currency=receipt.currency,
        subtotal_kobo=receipt.subtotal_kobo,
        discount_kobo=receipt.discount_kobo,
        total_kobo=receipt.total_kobo,
        amount_paid_kobo=receipt.amount_paid_kobo,
        payment_method=receipt.payment_method,  # type: ignore[arg-type]
        notes=receipt.notes or "",
        issued_at=normalize_utc(receipt.issued_at),
        status=receipt.status,  # type: ignore[arg-type]
        void_reason=receipt.void_reason,
        voided_at=(
            normalize_utc(receipt.voided_at) if receipt.voided_at else None
        ),
        content_hash=receipt.content_hash,
        created_at=normalize_utc(receipt.created_at),
        synced_at=normalize_utc(receipt.synced_at),
        items=items_resp,
        deliveries=deliveries_resp,
        sync_status=sync_status,  # type: ignore[arg-type]
    )


def _create_receipt_in_tx(
    db: Session,
    user: User,
    business: ProofBusiness,
    payload: ReceiptCreateRequest,
) -> tuple[ProofReceipt, str]:
    existing = db.scalar(
        select(ProofReceipt)
        .options(
            selectinload(ProofReceipt.items),
            selectinload(ProofReceipt.deliveries),
        )
        .where(ProofReceipt.id == payload.id)
    )
    if existing is not None:
        if existing.business_id == business.id:
            return existing, "existing"
        raise ProofError(
            409,
            "RECEIPT_ID_CONFLICT",
            "Receipt ID already exists under another business.",
        )

    raw_items: list[dict[str, Any]] = [
        {
            "description": item.description,
            "serial_number": item.serial_number,
            "quantity": item.quantity,
            "unit_price_kobo": item.unit_price_kobo,
        }
        for item in payload.items
    ]
    line_totals, subtotal_kobo, total_kobo = compute_receipt_totals(
        raw_items,
        payload.discount_kobo,
    )

    issued_at_utc = normalize_utc(payload.issued_at)
    number = _allocate_receipt_number(db, business.id, issued_at_utc)
    public_code = _allocate_public_code(db)

    content_hash = compute_content_hash(
        business_id=business.id,
        receipt_id=payload.id,
        number=number,
        record_type=payload.record_type,
        customer_name=payload.customer_name,
        currency=payload.currency,
        issued_at=issued_at_utc,
        items=raw_items,
        discount_kobo=payload.discount_kobo,
        total_kobo=total_kobo,
    )

    now = now_utc()
    receipt = ProofReceipt(
        id=payload.id,
        business_id=business.id,
        number=number,
        public_code=public_code,
        record_type=payload.record_type,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        currency=payload.currency,
        subtotal_kobo=subtotal_kobo,
        discount_kobo=payload.discount_kobo,
        total_kobo=total_kobo,
        amount_paid_kobo=payload.amount_paid_kobo,
        payment_method=payload.payment_method,
        notes=payload.notes,
        issued_at=issued_at_utc,
        status="valid",
        void_reason=None,
        voided_at=None,
        content_hash=content_hash,
        created_at=now,
        synced_at=now,
    )
    db.add(receipt)
    db.flush()

    for idx, (item_in, line_total) in enumerate(
        zip(payload.items, line_totals)
    ):
        db.add(
            ProofReceiptItem(
                receipt_id=receipt.id,
                position=idx,
                description=item_in.description,
                serial_number=item_in.serial_number,
                quantity=item_in.quantity,
                unit_price_kobo=item_in.unit_price_kobo,
                line_total_kobo=line_total,
            )
        )

    _upsert_customer_on_receipt(
        db=db,
        business_id=business.id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
    )

    db.add(
        ProofAuditLog(
            business_id=business.id,
            user_id=user.id,
            action="receipt.create",
            receipt_id=receipt.id,
            detail=f"Created receipt {number}",
        )
    )
    db.flush()
    db.refresh(receipt)
    return receipt, "created"


def create_receipt(
    db: Session,
    user: User,
    payload: ReceiptCreateRequest,
) -> ReceiptResponse:
    business = get_or_create_business(db, user)
    receipt, sync_status = _create_receipt_in_tx(db, user, business, payload)
    db.commit()
    db.refresh(receipt)
    return serialize_receipt(receipt, sync_status=sync_status)


def sync_receipts(
    db: Session,
    user: User,
    raw_receipts: list[dict[str, Any]],
) -> SyncReceiptsResponse:
    if len(raw_receipts) > 50:
        raise ProofError(
            422,
            "BATCH_TOO_LARGE",
            "Maximum of 50 receipts allowed per sync request.",
        )

    business = get_or_create_business(db, user)
    results: list[SyncReceiptResultItem] = []

    for raw_item in raw_receipts:
        raw_id: str | None = None
        if isinstance(raw_item, dict) and raw_item.get("id") is not None:
            raw_id = str(raw_item.get("id")).strip()[:36] or None

        try:
            with db.begin_nested():
                parsed = ReceiptCreateRequest.model_validate(raw_item)
                raw_id = parsed.id
                receipt, item_status = _create_receipt_in_tx(
                    db,
                    user,
                    business,
                    parsed,
                )
                results.append(
                    SyncReceiptResultItem(
                        id=receipt.id,
                        status=item_status,  # type: ignore[arg-type]
                        number=receipt.number,
                        public_code=receipt.public_code,
                        error=None,
                    )
                )
        except ValidationError as exc:
            first_msg = (
                exc.errors()[0].get("msg", "Invalid receipt payload.")
                if exc.errors()
                else "Invalid receipt payload."
            )
            results.append(
                SyncReceiptResultItem(
                    id=raw_id,
                    status="rejected",
                    number=None,
                    public_code=None,
                    error=first_msg,
                )
            )
        except ProofError as exc:
            results.append(
                SyncReceiptResultItem(
                    id=raw_id,
                    status="rejected",
                    number=None,
                    public_code=None,
                    error=exc.message,
                )
            )
        except (IntegrityError, ValueError) as exc:
            results.append(
                SyncReceiptResultItem(
                    id=raw_id,
                    status="rejected",
                    number=None,
                    public_code=None,
                    error=str(exc) or "Receipt could not be processed.",
                )
            )

    db.commit()
    return SyncReceiptsResponse(results=results)


def list_receipts(
    db: Session,
    user: User,
    *,
    q: str | None = None,
    status: str | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedReceiptsResponse:
    business = get_or_create_business(db, user)
    stmt = (
        select(ProofReceipt)
        .options(
            selectinload(ProofReceipt.items),
            selectinload(ProofReceipt.deliveries),
        )
        .where(ProofReceipt.business_id == business.id)
    )
    count_stmt = select(func.count(ProofReceipt.id)).where(
        ProofReceipt.business_id == business.id
    )

    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        cond = or_(
            func.lower(ProofReceipt.customer_name).like(needle),
            func.lower(ProofReceipt.number).like(needle),
            func.lower(ProofReceipt.public_code).like(needle),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    if status and status.strip():
        clean_status = status.strip().lower()
        if clean_status not in ("valid", "voided"):
            raise ProofError(
                422,
                "INVALID_STATUS",
                "status must be 'valid' or 'voided'.",
            )
        stmt = stmt.where(ProofReceipt.status == clean_status)
        count_stmt = count_stmt.where(ProofReceipt.status == clean_status)

    if from_dt is not None:
        utc_from = normalize_utc(from_dt)
        stmt = stmt.where(ProofReceipt.issued_at >= utc_from)
        count_stmt = count_stmt.where(ProofReceipt.issued_at >= utc_from)

    if to_dt is not None:
        utc_to = normalize_utc(to_dt)
        stmt = stmt.where(ProofReceipt.issued_at <= utc_to)
        count_stmt = count_stmt.where(ProofReceipt.issued_at <= utc_to)

    total = int(db.scalar(count_stmt) or 0)
    offset = (page - 1) * page_size
    rows = db.scalars(
        stmt.order_by(
            ProofReceipt.issued_at.desc(),
            ProofReceipt.created_at.desc(),
        )
        .offset(offset)
        .limit(page_size)
    ).all()

    return PaginatedReceiptsResponse(
        items=[serialize_receipt(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def _get_owned_receipt(
    db: Session,
    business_id: str,
    receipt_id: str,
) -> ProofReceipt:
    receipt = db.scalar(
        select(ProofReceipt)
        .options(
            selectinload(ProofReceipt.items),
            selectinload(ProofReceipt.deliveries),
        )
        .where(
            ProofReceipt.id == receipt_id,
            ProofReceipt.business_id == business_id,
        )
    )
    if receipt is None:
        raise ProofError(404, "RECEIPT_NOT_FOUND", "Receipt not found.")
    return receipt


def get_receipt(
    db: Session,
    user: User,
    receipt_id: str,
) -> ReceiptResponse:
    business = get_or_create_business(db, user)
    receipt = _get_owned_receipt(db, business.id, receipt_id)
    return serialize_receipt(receipt)


def void_receipt(
    db: Session,
    user: User,
    receipt_id: str,
    payload: ReceiptVoidRequest,
) -> ReceiptResponse:
    business = get_or_create_business(db, user)
    receipt = _get_owned_receipt(db, business.id, receipt_id)

    if receipt.status != "valid":
        raise ProofError(
            409,
            "RECEIPT_ALREADY_VOIDED",
            "Receipt is already voided.",
        )

    receipt.status = "voided"
    receipt.void_reason = payload.reason
    receipt.voided_at = now_utc()

    db.add(
        ProofAuditLog(
            business_id=business.id,
            user_id=user.id,
            action="receipt.void",
            receipt_id=receipt.id,
            detail=payload.reason[:300],
        )
    )
    db.commit()
    db.refresh(receipt)
    return serialize_receipt(receipt)


def create_delivery(
    db: Session,
    user: User,
    receipt_id: str,
    payload: DeliveryCreateRequest,
) -> DeliveryResponse:
    business = get_or_create_business(db, user)
    receipt = _get_owned_receipt(db, business.id, receipt_id)

    delivery = ProofDelivery(
        receipt_id=receipt.id,
        channel=payload.channel,
    )
    db.add(delivery)
    db.add(
        ProofAuditLog(
            business_id=business.id,
            user_id=user.id,
            action="receipt.delivery",
            receipt_id=receipt.id,
            detail=f"Delivered via {payload.channel}",
        )
    )
    db.commit()
    db.refresh(delivery)
    return DeliveryResponse(
        id=delivery.id,
        receipt_id=delivery.receipt_id,
        channel=delivery.channel,  # type: ignore[arg-type]
        created_at=normalize_utc(delivery.created_at),
    )


def verify_receipt_by_code(
    db: Session,
    code: str,
) -> tuple[VerifyReceiptResponse, int]:
    cleaned_code = (code or "").strip().upper()
    receipt: ProofReceipt | None = None
    if PUBLIC_CODE_RE.fullmatch(cleaned_code):
        receipt = db.scalar(
            select(ProofReceipt)
            .options(
                selectinload(ProofReceipt.items),
                selectinload(ProofReceipt.business),
            )
            .where(ProofReceipt.public_code == cleaned_code)
        )

    if receipt is None:
        # Run a constant-work dummy content hash computation to avoid timing enumeration
        dummy_hash = compute_content_hash(
            business_id="00000000-0000-0000-0000-000000000000",
            receipt_id="00000000-0000-0000-0000-000000000000",
            number="OP-2026-000001",
            record_type="sale",
            customer_name="Unknown",
            currency="NGN",
            issued_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            items=[
                {
                    "description": "Item",
                    "serial_number": "",
                    "quantity": 1,
                    "unit_price_kobo": 0,
                }
            ],
            discount_kobo=0,
            total_kobo=0,
        )
        verify_content_hash(dummy_hash, dummy_hash)
        return VerifyReceiptResponse(found=False), 404

    sorted_items = sorted(receipt.items, key=lambda x: x.position)
    raw_items = [
        {
            "description": item.description,
            "serial_number": item.serial_number or "",
            "quantity": item.quantity,
            "unit_price_kobo": item.unit_price_kobo,
        }
        for item in sorted_items
    ]
    recomputed_hash = compute_content_hash(
        business_id=receipt.business_id,
        receipt_id=receipt.id,
        number=receipt.number,
        record_type=receipt.record_type,
        customer_name=receipt.customer_name,
        currency=receipt.currency,
        issued_at=normalize_utc(receipt.issued_at),
        items=raw_items,
        discount_kobo=receipt.discount_kobo,
        total_kobo=receipt.total_kobo,
    )
    hash_valid = verify_content_hash(receipt.content_hash, recomputed_hash)

    return (
        VerifyReceiptResponse(
            found=True,
            status=receipt.status,  # type: ignore[arg-type]
            business_name=(
                receipt.business.name if receipt.business else "Business"
            ),
            business_logo_data=(
                (receipt.business.logo_data or "") if receipt.business else ""
            ),
            customer_name=receipt.customer_name,
            record_type=receipt.record_type,  # type: ignore[arg-type]
            issued_at=normalize_utc(receipt.issued_at),
            items=[
                VerifyReceiptItemResponse(
                    description=item.description,
                    serial_number=item.serial_number or "",
                    quantity=item.quantity,
                    unit_price_kobo=item.unit_price_kobo,
                )
                for item in sorted_items
            ],
            total_kobo=receipt.total_kobo,
            amount_paid_kobo=receipt.amount_paid_kobo,
            void_reason=receipt.void_reason,
            hash_valid=hash_valid,
        ),
        200,
    )


def _serialize_customer(customer: ProofCustomer) -> CustomerResponse:
    return CustomerResponse(
        id=customer.id,
        business_id=customer.business_id,
        name=customer.name,
        phone=customer.phone or "",
        email=customer.email or "",
        created_at=normalize_utc(customer.created_at),
    )


def list_customers(
    db: Session,
    user: User,
    *,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedCustomersResponse:
    business = get_or_create_business(db, user)
    stmt = select(ProofCustomer).where(ProofCustomer.business_id == business.id)
    count_stmt = select(func.count(ProofCustomer.id)).where(
        ProofCustomer.business_id == business.id
    )

    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        cond = or_(
            func.lower(ProofCustomer.name).like(needle),
            func.lower(func.coalesce(ProofCustomer.phone, "")).like(needle),
            func.lower(func.coalesce(ProofCustomer.email, "")).like(needle),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = int(db.scalar(count_stmt) or 0)
    offset = (page - 1) * page_size
    rows = db.scalars(
        stmt.order_by(ProofCustomer.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    return PaginatedCustomersResponse(
        items=[_serialize_customer(c) for c in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def create_customer(
    db: Session,
    user: User,
    payload: CustomerUpsertRequest,
) -> CustomerResponse:
    business = get_or_create_business(db, user)
    phone_val = payload.phone.strip() or None

    if phone_val is not None:
        existing = db.scalar(
            select(ProofCustomer).where(
                ProofCustomer.business_id == business.id,
                ProofCustomer.phone == phone_val,
            )
        )
        if existing is not None:
            existing.name = payload.name
            existing.email = payload.email
            db.commit()
            db.refresh(existing)
            return _serialize_customer(existing)

    customer = ProofCustomer(
        business_id=business.id,
        name=payload.name,
        phone=phone_val,
        email=payload.email,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)


def update_customer(
    db: Session,
    user: User,
    customer_id: str,
    payload: CustomerUpsertRequest,
) -> CustomerResponse:
    business = get_or_create_business(db, user)
    customer = db.scalar(
        select(ProofCustomer).where(
            ProofCustomer.id == customer_id,
            ProofCustomer.business_id == business.id,
        )
    )
    if customer is None:
        raise ProofError(404, "CUSTOMER_NOT_FOUND", "Customer not found.")

    phone_val = payload.phone.strip() or None
    if phone_val is not None and phone_val != customer.phone:
        conflict = db.scalar(
            select(ProofCustomer).where(
                ProofCustomer.business_id == business.id,
                ProofCustomer.phone == phone_val,
                ProofCustomer.id != customer.id,
            )
        )
        if conflict is not None:
            raise ProofError(
                409,
                "CUSTOMER_PHONE_CONFLICT",
                "Another customer in your business already uses this phone number.",
            )

    customer.name = payload.name
    customer.phone = phone_val
    customer.email = payload.email
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)


def _serialize_business(business: ProofBusiness) -> BusinessResponse:
    return BusinessResponse(
        id=business.id,
        name=business.name,
        phone=business.phone or "",
        email=business.email or "",
        address=business.address or "",
        logo_data=business.logo_data or "",
        receipt_prefix=business.receipt_prefix,
        next_seq=business.next_seq,
        created_at=normalize_utc(business.created_at),
        updated_at=normalize_utc(business.updated_at),
    )


def get_business_profile(db: Session, user: User) -> BusinessResponse:
    business = get_or_create_business(db, user)
    return _serialize_business(business)


def update_business_profile(
    db: Session,
    user: User,
    payload: BusinessUpdateRequest,
) -> BusinessResponse:
    business = get_or_create_business(db, user)
    business.name = payload.name
    business.phone = payload.phone
    business.email = payload.email
    business.address = payload.address
    business.logo_data = payload.logo_data
    business.receipt_prefix = payload.receipt_prefix
    business.updated_at = now_utc()
    db.commit()
    db.refresh(business)
    return _serialize_business(business)


def get_reports_summary(
    db: Session,
    user: User,
    period: ReportPeriod = "day",
    ref_date: date | None = None,
) -> ReportSummaryResponse:
    business = get_or_create_business(db, user)
    target_date = ref_date or now_utc().date()

    if period == "day":
        start_date = target_date
        end_date = target_date
    elif period == "week":
        start_date = target_date - timedelta(days=6)
        end_date = target_date
    elif period == "month":
        start_date = target_date.replace(day=1)
        last_day = calendar.monthrange(target_date.year, target_date.month)[1]
        end_date = target_date.replace(day=last_day)
    else:
        raise ProofError(
            422,
            "INVALID_PERIOD",
            "period must be 'day', 'week', or 'month'.",
        )

    start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, time.max, tzinfo=timezone.utc)

    receipts = db.scalars(
        select(ProofReceipt).where(
            ProofReceipt.business_id == business.id,
            ProofReceipt.issued_at >= start_dt,
            ProofReceipt.issued_at <= end_dt,
        )
    ).all()

    day_map: dict[str, dict[str, int]] = {}
    cursor = start_date
    while cursor <= end_date:
        day_key = cursor.isoformat()
        day_map[day_key] = {
            "total_sales_kobo": 0,
            "total_purchases_kobo": 0,
            "receipt_count": 0,
            "voided_count": 0,
            "amount_paid_kobo": 0,
            "outstanding_balance_kobo": 0,
        }
        cursor += timedelta(days=1)

    total_sales_kobo = 0
    total_purchases_kobo = 0
    receipt_count = 0
    voided_count = 0
    amount_paid_kobo = 0
    outstanding_balance_kobo = 0

    for r in receipts:
        r_date = normalize_utc(r.issued_at).date().isoformat()
        bucket = day_map.get(r_date)
        if r.status == "voided":
            voided_count += 1
            if bucket is not None:
                bucket["voided_count"] += 1
            continue

        # Exclude voided receipts from totals
        receipt_count += 1
        paid = int(r.amount_paid_kobo or 0)
        total = int(r.total_kobo or 0)
        outstanding = max(0, total - paid)

        amount_paid_kobo += paid
        outstanding_balance_kobo += outstanding

        if r.record_type in ("sale", "service"):
            total_sales_kobo += total
        elif r.record_type == "purchase":
            total_purchases_kobo += total

        if bucket is not None:
            bucket["receipt_count"] += 1
            bucket["amount_paid_kobo"] += paid
            bucket["outstanding_balance_kobo"] += outstanding
            if r.record_type in ("sale", "service"):
                bucket["total_sales_kobo"] += total
            elif r.record_type == "purchase":
                bucket["total_purchases_kobo"] += total

    series = [
        ReportDayPoint(
            date=day_key,
            total_sales_kobo=vals["total_sales_kobo"],
            total_purchases_kobo=vals["total_purchases_kobo"],
            receipt_count=vals["receipt_count"],
            voided_count=vals["voided_count"],
            amount_paid_kobo=vals["amount_paid_kobo"],
            outstanding_balance_kobo=vals["outstanding_balance_kobo"],
        )
        for day_key, vals in day_map.items()
    ]

    return ReportSummaryResponse(
        period=period,
        reference_date=target_date,
        start_date=start_date,
        end_date=end_date,
        total_sales_kobo=total_sales_kobo,
        total_purchases_kobo=total_purchases_kobo,
        receipt_count=receipt_count,
        voided_count=voided_count,
        amount_paid_kobo=amount_paid_kobo,
        outstanding_balance_kobo=outstanding_balance_kobo,
        series=series,
    )
