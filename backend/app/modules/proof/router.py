from datetime import date, datetime, time, timezone
from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User
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
    ReceiptResponse,
    ReceiptVoidRequest,
    ReportPeriod,
    ReportSummaryResponse,
    SyncReceiptsRequest,
    SyncReceiptsResponse,
    VerifyReceiptResponse,
)
from .security import (
    enforce_proof_body_limit,
    rate_limit_verify,
    require_proof_user,
)
from .service import (
    ProofError,
    create_customer,
    create_delivery,
    create_receipt,
    get_business_profile,
    get_receipt,
    get_reports_summary,
    list_customers,
    list_receipts,
    sync_receipts,
    update_business_profile,
    update_customer,
    verify_receipt_by_code,
    void_receipt,
)
from .utils import normalize_utc

router = APIRouter(
    prefix="/proof",
    tags=["OjaProof"],
    dependencies=[Depends(enforce_proof_body_limit)],
)


def _parse_date_or_datetime(
    raw: str | None,
    *,
    is_end_of_day: bool = False,
) -> datetime | None:
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()
    try:
        if len(cleaned) == 10:
            parsed_date = date.fromisoformat(cleaned)
            return datetime.combine(
                parsed_date,
                time.max if is_end_of_day else time.min,
                tzinfo=timezone.utc,
            )
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        return normalize_utc(datetime.fromisoformat(cleaned))
    except ValueError as exc:
        raise ProofError(
            422,
            "INVALID_DATE_RANGE",
            f"Invalid ISO date or datetime: {raw}",
        ) from exc


@router.post("/receipts", response_model=ReceiptResponse)
def create_receipt_route(
    payload: ReceiptCreateRequest,
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> ReceiptResponse:
    return create_receipt(db, user, payload)


@router.post("/receipts/sync", response_model=SyncReceiptsResponse)
def sync_receipts_route(
    payload: SyncReceiptsRequest,
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> SyncReceiptsResponse:
    return sync_receipts(db, user, payload.receipts)


@router.get("/receipts", response_model=PaginatedReceiptsResponse)
def list_receipts_route(
    q: str | None = Query(default=None, max_length=120),
    status: str | None = Query(default=None, max_length=20),
    from_param: str | None = Query(default=None, alias="from", max_length=40),
    to_param: str | None = Query(default=None, alias="to", max_length=40),
    page: int = Query(default=1, ge=1, le=100_000),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=50),
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> PaginatedReceiptsResponse:
    from_dt = _parse_date_or_datetime(from_param, is_end_of_day=False)
    to_dt = _parse_date_or_datetime(to_param, is_end_of_day=True)
    return list_receipts(
        db,
        user,
        q=q,
        status=status,
        from_dt=from_dt,
        to_dt=to_dt,
        page=page,
        page_size=page_size,
    )


@router.get("/receipts/{id}", response_model=ReceiptResponse)
def get_receipt_route(
    id: str = Path(min_length=1, max_length=36),
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> ReceiptResponse:
    return get_receipt(db, user, id)


@router.post("/receipts/{id}/void", response_model=ReceiptResponse)
def void_receipt_route(
    payload: ReceiptVoidRequest,
    id: str = Path(min_length=1, max_length=36),
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> ReceiptResponse:
    return void_receipt(db, user, id, payload)


@router.post("/receipts/{id}/deliveries", response_model=DeliveryResponse)
def create_delivery_route(
    payload: DeliveryCreateRequest,
    id: str = Path(min_length=1, max_length=36),
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> DeliveryResponse:
    return create_delivery(db, user, id, payload)


@router.get("/customers", response_model=PaginatedCustomersResponse)
def list_customers_route(
    q: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1, le=100_000),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=50),
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> PaginatedCustomersResponse:
    return list_customers(
        db,
        user,
        q=q,
        page=page,
        page_size=page_size,
    )


@router.post("/customers", response_model=CustomerResponse)
def create_customer_route(
    payload: CustomerUpsertRequest,
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> CustomerResponse:
    return create_customer(db, user, payload)


@router.put("/customers/{id}", response_model=CustomerResponse)
def update_customer_route(
    payload: CustomerUpsertRequest,
    id: str = Path(min_length=1, max_length=36),
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> CustomerResponse:
    return update_customer(db, user, id, payload)


@router.get("/business", response_model=BusinessResponse)
def get_business_route(
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> BusinessResponse:
    return get_business_profile(db, user)


@router.put("/business", response_model=BusinessResponse)
def update_business_route(
    payload: BusinessUpdateRequest,
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> BusinessResponse:
    return update_business_profile(db, user, payload)


@router.get("/reports/summary", response_model=ReportSummaryResponse)
def get_reports_summary_route(
    period: ReportPeriod = Query(default="day"),
    date_param: date | None = Query(default=None, alias="date"),
    user: User = Depends(require_proof_user),
    db: Session = Depends(get_db),
) -> ReportSummaryResponse:
    return get_reports_summary(
        db,
        user,
        period=period,
        ref_date=date_param,
    )


@router.get("/verify/{code}", response_model=VerifyReceiptResponse)
def verify_receipt_route(
    response: Response,
    code: str = Path(min_length=1, max_length=32),
    _rate_limit: None = Depends(rate_limit_verify),
    db: Session = Depends(get_db),
) -> VerifyReceiptResponse:
    result, status_code = verify_receipt_by_code(db, code)
    response.status_code = status_code
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return result
