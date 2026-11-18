from datetime import date, datetime, timedelta
import re
from typing import Any, Literal
from uuid import uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from ...models import now_utc
from .utils import compute_receipt_totals, normalize_utc, to_camel

RecordType = Literal["sale", "purchase", "service", "transfer"]
PaymentMethod = Literal["cash", "transfer", "pos", "credit"]
ReceiptStatus = Literal["valid", "voided"]
DeliveryChannel = Literal["whatsapp", "gmail", "call", "copy"]
SyncItemStatus = Literal["created", "existing", "rejected"]
ReportPeriod = Literal["day", "week", "month"]

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
PREFIX_RE = re.compile(r"^[A-Z0-9]{2,6}$")
MAX_LOGO_BYTES = 200 * 1024  # 200 KB


def _validate_optional_email(value: str | None) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        return ""
    if len(cleaned) > 160 or not EMAIL_RE.fullmatch(cleaned):
        raise ValueError("Enter a valid email address.")
    return cleaned


def _validate_optional_phone(value: str | None) -> str:
    cleaned = (value or "").strip()
    if len(cleaned) > 20:
        raise ValueError("Phone number must be at most 20 characters.")
    return cleaned


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="ignore",
    )


class ReceiptItemInput(CamelModel):
    description: str
    serial_number: str = ""
    quantity: int = Field(ge=1, le=100_000)
    unit_price_kobo: int = Field(ge=0, le=100_000_000_000)

    @field_validator("description", mode="before")
    @classmethod
    def _clean_description(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Item description must be a string.")
        cleaned = v.strip()
        if not (1 <= len(cleaned) <= 200):
            raise ValueError(
                "Item description must be between 1 and 200 characters."
            )
        return cleaned

    @field_validator("serial_number", mode="before")
    @classmethod
    def _clean_serial(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("serialNumber must be a string.")
        cleaned = v.strip()
        if len(cleaned) > 100:
            raise ValueError("serialNumber must be at most 100 characters.")
        return cleaned

    @field_validator("quantity", "unit_price_kobo", mode="before")
    @classmethod
    def _reject_bool_ints(cls, v: Any) -> int:
        if isinstance(v, bool) or not isinstance(v, int):
            raise ValueError("Value must be an integer.")
        return v


class ReceiptItemResponse(CamelModel):
    id: str
    position: int
    description: str
    serial_number: str
    quantity: int
    unit_price_kobo: int
    line_total_kobo: int


class DeliveryCreateRequest(CamelModel):
    channel: DeliveryChannel


class DeliveryResponse(CamelModel):
    id: str
    receipt_id: str
    channel: DeliveryChannel
    created_at: datetime


class ReceiptCreateRequest(CamelModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    record_type: RecordType = "sale"
    customer_name: str
    customer_phone: str = ""
    customer_email: str = ""
    currency: str = "NGN"
    items: list[ReceiptItemInput] = Field(min_length=1, max_length=100)
    discount_kobo: int = Field(default=0, ge=0, le=10_000_000_000_000)
    amount_paid_kobo: int = Field(default=0, ge=0, le=10_000_000_000_000)
    payment_method: PaymentMethod = "cash"
    notes: str = ""
    issued_at: datetime = Field(default_factory=now_utc)

    @field_validator("id", mode="before")
    @classmethod
    def _clean_id(cls, v: Any) -> str:
        if v is None or v == "":
            return str(uuid4())
        if not isinstance(v, str):
            raise ValueError("id must be a string.")
        cleaned = v.strip()
        if not (1 <= len(cleaned) <= 36):
            raise ValueError("id must be between 1 and 36 characters.")
        return cleaned

    @field_validator("customer_name", mode="before")
    @classmethod
    def _clean_customer_name(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("customerName is required.")
        cleaned = v.strip()
        if not (1 <= len(cleaned) <= 120):
            raise ValueError(
                "customerName must be between 1 and 120 characters."
            )
        return cleaned

    @field_validator("customer_phone", mode="before")
    @classmethod
    def _clean_customer_phone(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("customerPhone must be a string.")
        return _validate_optional_phone(v)

    @field_validator("customer_email", mode="before")
    @classmethod
    def _clean_customer_email(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("customerEmail must be a string.")
        return _validate_optional_email(v)

    @field_validator("currency", mode="before")
    @classmethod
    def _clean_currency(cls, v: Any) -> str:
        cleaned = str(v or "NGN").strip().upper()
        if not (1 <= len(cleaned) <= 10):
            raise ValueError("currency must be between 1 and 10 characters.")
        return cleaned

    @field_validator("discount_kobo", "amount_paid_kobo", mode="before")
    @classmethod
    def _reject_bool_money(cls, v: Any) -> int:
        if isinstance(v, bool) or not isinstance(v, int):
            raise ValueError("Money amounts must be integers in kobo.")
        return v

    @field_validator("notes", mode="before")
    @classmethod
    def _clean_notes(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("notes must be a string.")
        cleaned = v.strip()
        if len(cleaned) > 1000:
            raise ValueError("notes must be at most 1000 characters.")
        return cleaned

    @field_validator("issued_at", mode="after")
    @classmethod
    def _validate_issued_at(cls, v: datetime) -> datetime:
        utc_dt = normalize_utc(v)
        max_future = now_utc() + timedelta(hours=24)
        if utc_dt > max_future:
            raise ValueError(
                "issuedAt must not be more than 24 hours in the future."
            )
        return utc_dt

    @model_validator(mode="after")
    def _validate_totals(self) -> "ReceiptCreateRequest":
        raw_items = [
            {
                "description": item.description,
                "serial_number": item.serial_number,
                "quantity": item.quantity,
                "unit_price_kobo": item.unit_price_kobo,
            }
            for item in self.items
        ]
        compute_receipt_totals(raw_items, self.discount_kobo)
        return self


class ReceiptVoidRequest(CamelModel):
    reason: str

    @field_validator("reason", mode="before")
    @classmethod
    def _clean_reason(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Void reason is required.")
        cleaned = v.strip()
        if not (3 <= len(cleaned) <= 300):
            raise ValueError(
                "Void reason must be between 3 and 300 characters."
            )
        return cleaned


class ReceiptResponse(CamelModel):
    id: str
    business_id: str
    number: str
    public_code: str
    record_type: RecordType
    customer_name: str
    customer_phone: str
    customer_email: str
    currency: str
    subtotal_kobo: int
    discount_kobo: int
    total_kobo: int
    amount_paid_kobo: int
    payment_method: PaymentMethod
    notes: str
    issued_at: datetime
    status: ReceiptStatus
    void_reason: str | None = None
    voided_at: datetime | None = None
    content_hash: str
    created_at: datetime
    synced_at: datetime
    items: list[ReceiptItemResponse] = Field(default_factory=list)
    deliveries: list[DeliveryResponse] = Field(default_factory=list)
    sync_status: Literal["created", "existing"] | None = None


class PaginatedReceiptsResponse(CamelModel):
    items: list[ReceiptResponse]
    total: int
    page: int
    page_size: int


class SyncReceiptsRequest(CamelModel):
    receipts: list[dict[str, Any]] = Field(
        default_factory=list,
        max_length=50,
    )


class SyncReceiptResultItem(CamelModel):
    id: str | None = None
    status: SyncItemStatus
    number: str | None = None
    public_code: str | None = None
    error: str | None = None


class SyncReceiptsResponse(CamelModel):
    results: list[SyncReceiptResultItem]


class CustomerUpsertRequest(CamelModel):
    name: str
    phone: str = ""
    email: str = ""

    @field_validator("name", mode="before")
    @classmethod
    def _clean_name(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Customer name is required.")
        cleaned = v.strip()
        if not (1 <= len(cleaned) <= 120):
            raise ValueError(
                "Customer name must be between 1 and 120 characters."
            )
        return cleaned

    @field_validator("phone", mode="before")
    @classmethod
    def _clean_phone(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("phone must be a string.")
        return _validate_optional_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def _clean_email(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("email must be a string.")
        return _validate_optional_email(v)


class CustomerResponse(CamelModel):
    id: str
    business_id: str
    name: str
    phone: str = ""
    email: str = ""
    created_at: datetime


class PaginatedCustomersResponse(CamelModel):
    items: list[CustomerResponse]
    total: int
    page: int
    page_size: int


class BusinessUpdateRequest(CamelModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    logo_data: str = ""
    receipt_prefix: str = "OP"

    @model_validator(mode="before")
    @classmethod
    def _support_logo_base64_alias(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if (
                "logoData" not in data
                and "logo_data" not in data
                and "logoBase64" in data
            ):
                copied = dict(data)
                copied["logoData"] = copied["logoBase64"]
                return copied
        return data

    @field_validator("name", mode="before")
    @classmethod
    def _clean_business_name(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Business name is required.")
        cleaned = v.strip()
        if not (1 <= len(cleaned) <= 160):
            raise ValueError(
                "Business name must be between 1 and 160 characters."
            )
        return cleaned

    @field_validator("phone", mode="before")
    @classmethod
    def _clean_business_phone(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("phone must be a string.")
        return _validate_optional_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def _clean_business_email(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("email must be a string.")
        return _validate_optional_email(v)

    @field_validator("address", mode="before")
    @classmethod
    def _clean_address(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("address must be a string.")
        cleaned = v.strip()
        if len(cleaned) > 255:
            raise ValueError("address must be at most 255 characters.")
        return cleaned

    @field_validator("logo_data", mode="before")
    @classmethod
    def _clean_logo_data(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            raise ValueError("logoData must be a base64 string.")
        cleaned = v.strip()
        if len(cleaned.encode("utf-8")) > MAX_LOGO_BYTES:
            raise ValueError("logoData must not exceed 200 KB.")
        return cleaned

    @field_validator("receipt_prefix", mode="before")
    @classmethod
    def _clean_receipt_prefix(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("receiptPrefix must be a string.")
        cleaned = v.strip().upper()
        if not PREFIX_RE.fullmatch(cleaned):
            raise ValueError(
                "receiptPrefix must be 2 to 6 uppercase letters or digits."
            )
        return cleaned


class BusinessResponse(CamelModel):
    id: str
    name: str
    phone: str
    email: str
    address: str
    logo_data: str = ""
    receipt_prefix: str
    next_seq: int
    created_at: datetime
    updated_at: datetime


class ReportDayPoint(CamelModel):
    date: str
    total_sales_kobo: int
    total_purchases_kobo: int
    receipt_count: int
    voided_count: int
    amount_paid_kobo: int
    outstanding_balance_kobo: int


class ReportSummaryResponse(CamelModel):
    period: ReportPeriod
    reference_date: date
    start_date: date
    end_date: date
    total_sales_kobo: int
    total_purchases_kobo: int
    receipt_count: int
    voided_count: int
    amount_paid_kobo: int
    outstanding_balance_kobo: int
    series: list[ReportDayPoint]


class VerifyReceiptItemResponse(CamelModel):
    description: str
    serial_number: str
    quantity: int
    unit_price_kobo: int


class VerifyReceiptResponse(CamelModel):
    found: bool
    status: ReceiptStatus | None = None
    business_name: str | None = None
    business_logo_data: str | None = None
    customer_name: str | None = None
    record_type: RecordType | None = None
    issued_at: datetime | None = None
    items: list[VerifyReceiptItemResponse] = Field(default_factory=list)
    total_kobo: int | None = None
    amount_paid_kobo: int | None = None
    void_reason: str | None = None
    hash_valid: bool | None = None

