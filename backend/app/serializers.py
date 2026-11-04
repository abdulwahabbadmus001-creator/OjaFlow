from typing import Any

from .models import Business, StoreState, User

EMPTY_STORE_DATA: dict[str, list[Any]] = {
    "products": [],
    "sales": [],
    "expenses": [],
    "debts": [],
    "customers": [],
    "invoices": [],
}


def normalize_store_data(raw: dict[str, Any] | None) -> dict[str, list[Any]]:
    source = raw if isinstance(raw, dict) else {}
    return {
        key: list(source[key]) if isinstance(source.get(key), list) else []
        for key in EMPTY_STORE_DATA
    }


def merge_store_data(
    existing_raw: dict[str, Any] | None,
    incoming_raw: dict[str, Any] | None,
) -> dict[str, list[Any]]:
    """
    Conflict-free merge of store collections across devices by item `id`.
    Incoming items take precedence for matching IDs (supporting edits such as
    stock adjustments, debt payments, and customer/invoice updates), while
    records created on other devices that are not yet in the client's snapshot
    are preserved without data loss.
    """
    existing = normalize_store_data(existing_raw)
    incoming = normalize_store_data(incoming_raw)
    merged: dict[str, list[Any]] = {}

    for key in EMPTY_STORE_DATA:
        seen_ids: set[str] = set()
        combined: list[Any] = []
        for item in [*incoming[key], *existing[key]]:
            if isinstance(item, dict):
                item_id = str(item.get("id") or "").strip()
                if item_id:
                    if item_id in seen_ids:
                        continue
                    seen_ids.add(item_id)
            combined.append(item)
        merged[key] = combined[:5000]

    return merged


def user_profile(user: User) -> dict:
    return {
        "uid": user.id,
        "ojaTag": user.oja_tag or "",
        "phoneNumber": user.phone,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "otherName": (user.other_name or ""),
        "preferredLanguage": (user.preferred_language),
        "onboardingCompleted": (user.onboarding_completed),
        "businessProfileCompleted": (user.business_profile_completed),
        "securityQuestion": (user.security_question or ""),
    }


def business_profile(business: Business | None) -> dict | None:
    if not business:
        return None

    return {
        "businessName": (business.business_name),
        "category": business.category,
        "phone": business.phone,
        "address": business.address,
        "currency": business.currency,
    }


def store_snapshot(store: StoreState | None) -> dict:
    if not store:
        return {
            "data": normalize_store_data(None),
            "version": 0,
            "updatedAt": None,
        }
    return {
        "data": normalize_store_data(store.data),
        "version": store.version or 0,
        "updatedAt": (
            store.updated_at.isoformat() if store.updated_at else None
        ),
    }
