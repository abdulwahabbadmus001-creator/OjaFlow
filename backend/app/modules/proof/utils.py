from datetime import datetime, timezone
import hashlib
import hmac
import json
import secrets
from typing import Any, Sequence

PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PUBLIC_CODE_LENGTH = 8


def to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


def normalize_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def canonical_iso_utc(dt: datetime) -> str:
    utc_dt = normalize_utc(dt)
    return utc_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def generate_public_code() -> str:
    return "".join(
        secrets.choice(PUBLIC_CODE_ALPHABET) for _ in range(PUBLIC_CODE_LENGTH)
    )


def format_receipt_number(prefix: str, issued_at: datetime, seq: int) -> str:
    clean_prefix = (prefix or "OP").strip().upper()
    year = normalize_utc(issued_at).year
    return f"{clean_prefix}-{year:04d}-{seq:06d}"


def compute_receipt_totals(
    items: Sequence[dict[str, int | str]],
    discount_kobo: int,
) -> tuple[list[int], int, int]:
    """
    Recompute line totals, subtotal, and total in integer kobo from items.
    Returns (line_totals_kobo, subtotal_kobo, total_kobo).
    """
    if discount_kobo < 0:
        raise ValueError("discountKobo must be a non-negative integer.")

    line_totals: list[int] = []
    subtotal_kobo = 0
    for item in items:
        qty = int(item["quantity"])
        unit_price = int(item["unit_price_kobo"])
        line_total = qty * unit_price
        line_totals.append(line_total)
        subtotal_kobo += line_total

    if discount_kobo > subtotal_kobo:
        raise ValueError("discountKobo must not exceed subtotalKobo.")

    total_kobo = subtotal_kobo - discount_kobo
    return line_totals, subtotal_kobo, total_kobo


def compute_content_hash(
    *,
    business_id: str,
    receipt_id: str,
    number: str,
    record_type: str,
    customer_name: str,
    currency: str,
    issued_at: datetime,
    items: Sequence[dict[str, Any]],
    discount_kobo: int,
    total_kobo: int,
) -> str:
    """
    Compute SHA-256 over a canonical JSON string of fixed-order receipt fields.
    Excludes status, void fields, phone, email, and notes.
    """
    canonical_items = [
        {
            "description": str(item["description"]),
            "serial_number": str(item.get("serial_number") or ""),
            "quantity": int(item["quantity"]),
            "unit_price_kobo": int(item["unit_price_kobo"]),
        }
        for item in items
    ]
    ordered_payload = {
        "business_id": str(business_id),
        "receipt_id": str(receipt_id),
        "number": str(number),
        "record_type": str(record_type),
        "customer_name": str(customer_name),
        "currency": str(currency),
        "issued_at": canonical_iso_utc(issued_at),
        "items": canonical_items,
        "discount_kobo": int(discount_kobo),
        "total_kobo": int(total_kobo),
    }
    raw_json = json.dumps(
        ordered_payload,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(raw_json.encode("utf-8")).hexdigest()


def verify_content_hash(expected_hash: str, recomputed_hash: str) -> bool:
    if not expected_hash or not recomputed_hash:
        return False
    return hmac.compare_digest(
        expected_hash.encode("utf-8"),
        recomputed_hash.encode("utf-8"),
    )
