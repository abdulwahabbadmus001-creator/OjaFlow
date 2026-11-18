import os
from pathlib import Path
import secrets

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

# Provision runtime-generated secrets before importing the FastAPI app
_RUNTIME_ADMIN_EMAIL = f"admin-{secrets.token_hex(6)}@example.test"
_RUNTIME_ADMIN_PASSWORD = secrets.token_urlsafe(18)
_RUNTIME_SESSION_SECRET = secrets.token_urlsafe(32)

os.environ.setdefault("ADMIN_EMAIL", _RUNTIME_ADMIN_EMAIL)
os.environ.setdefault("ADMIN_PASSWORD", _RUNTIME_ADMIN_PASSWORD)
os.environ.setdefault("SESSION_SECRET", _RUNTIME_SESSION_SECRET)

from backend.app.config import Settings, get_settings  # noqa: E402
from backend.app.database import engine  # noqa: E402
from backend.app.main import app  # noqa: E402
from backend.app.migrations import _seed_system_admin  # noqa: E402
from backend.app.models import (  # noqa: E402
    AdminUser,
    Business,
    OtpChallenge,
    StoreState,
    SupportTicket,
    User,
    UserNotification,
)
from backend.app.security import _rate_buckets, _revoked_tokens  # noqa: E402

TEST_PHONE = "+2348099887766"


def _configure_runtime_admin(admin_email: str, admin_password: str) -> None:
    os.environ["ADMIN_EMAIL"] = admin_email
    os.environ["ADMIN_PASSWORD"] = admin_password
    os.environ["SESSION_SECRET"] = os.environ.get(
        "SESSION_SECRET"
    ) or secrets.token_urlsafe(32)
    get_settings.cache_clear()
    _seed_system_admin(engine)


def _cleanup_test_user() -> None:
    _rate_buckets.clear()
    _revoked_tokens.clear()
    with Session(bind=engine) as session:
        user = session.scalar(select(User).where(User.phone == TEST_PHONE))
        if user:
            session.execute(
                delete(UserNotification).where(UserNotification.user_id == user.id)
            )
            session.execute(
                delete(SupportTicket).where(SupportTicket.user_id == user.id)
            )
            session.execute(delete(OtpChallenge).where(OtpChallenge.user_id == user.id))
            session.execute(delete(StoreState).where(StoreState.user_id == user.id))
            session.execute(delete(Business).where(Business.user_id == user.id))
            session.execute(delete(User).where(User.id == user.id))
        session.commit()


@pytest.fixture()
def admin_credentials(monkeypatch: pytest.MonkeyPatch) -> tuple[str, str]:
    admin_email = f"admin-{secrets.token_hex(6)}@example.test"
    admin_password = secrets.token_urlsafe(18)
    session_secret = secrets.token_urlsafe(32)
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    monkeypatch.setenv("ADMIN_PASSWORD", admin_password)
    monkeypatch.setenv("SESSION_SECRET", session_secret)
    get_settings.cache_clear()
    _rate_buckets.clear()
    _revoked_tokens.clear()
    _seed_system_admin(engine)
    yield admin_email, admin_password
    _rate_buckets.clear()
    _revoked_tokens.clear()


def run_suite(
    admin_email: str | None = None,
    admin_password: str | None = None,
) -> None:
    resolved_email = admin_email or f"admin-{secrets.token_hex(6)}@example.test"
    resolved_password = admin_password or secrets.token_urlsafe(18)
    _configure_runtime_admin(resolved_email, resolved_password)
    _cleanup_test_user()
    client = TestClient(app)

    # 1. Health & PWA Microphone Security Header check
    health = client.get("/api/health")
    assert health.status_code == 200, health.text
    assert "microphone=(self)" in health.headers.get("Permissions-Policy", "")

    # 2. Zero-cost 4-digit PIN registration with localized Yorùbá security question
    reg = client.post(
        "/api/auth/register",
        json={
            "phone": TEST_PHONE,
            "firstName": "Amina",
            "lastName": "Balogun",
            "otherName": "",
            "preferredLanguage": "yo",
            "pin": "4829",
            "securityQuestion": "Kí ni orúkọ ọjà mi?",
            "securityAnswer": "Ọjà Balógun",
        },
    )
    assert reg.status_code == 200, reg.text
    reg_body = reg.json()
    uid = reg_body["profile"]["uid"]
    oja_tag = reg_body["profile"]["ojaTag"]
    user_token = reg_body["accessToken"]
    user_csrf = reg_body["csrfToken"]

    # 3. Cross-device Store Syncing (Bearer auth without cookies)
    client.cookies.clear()
    save_store = client.put(
        "/api/store",
        headers={
            "Authorization": f"Bearer {user_token}",
            "X-CSRF-Token": user_csrf,
        },
        json={
            "version": 0,
            "data": {
                "products": [
                    {
                        "id": "prod-1",
                        "name": "Bag of Rice",
                        "category": "Grains",
                        "costPrice": 65000,
                        "sellingPrice": 72000,
                        "stock": 3,
                        "lowStockAt": 5,
                    }
                ],
                "sales": [],
                "expenses": [],
                "debts": [],
                "customers": [],
                "invoices": [],
            },
        },
    )
    assert save_store.status_code == 200, save_store.text
    assert len(save_store.json()["data"]["products"]) == 1

    # 4. Localized PIN Recovery Flow
    q_res = client.post(
        "/api/auth/recovery/question",
        json={"identifier": oja_tag, "preferredLanguage": "yo"},
    )
    assert q_res.status_code == 200, q_res.text
    assert q_res.json()["securityQuestion"] == "Kí ni orúkọ ọjà mi?"

    v_res = client.post(
        "/api/auth/recovery/verify-answer",
        json={"identifier": oja_tag, "securityAnswer": "  ọjà balógun  "},
    )
    assert v_res.status_code == 200, v_res.text
    recovery_token = v_res.json()["recoveryToken"]

    reset_res = client.post(
        "/api/auth/recovery/reset-pin",
        json={
            "identifier": oja_tag,
            "recoveryToken": recovery_token,
            "newPin": "9137",
        },
    )
    assert reset_res.status_code == 200, reset_res.text
    user_token = reset_res.json()["accessToken"]
    user_csrf = reset_res.json()["csrfToken"]

    # 5. Trader submits a Support Ticket
    ticket_res = client.post(
        "/api/support/ticket",
        headers={
            "Authorization": f"Bearer {user_token}",
            "X-CSRF-Token": user_csrf,
        },
        json={
            "category": "Inventory",
            "subject": "Low stock alarm check",
            "message": "How do I adjust low stock threshold?",
        },
    )
    assert ticket_res.status_code == 200, ticket_res.text
    ticket_id = ticket_res.json()["ticket"]["id"]

    # 6. Dedicated System Admin Login, Ticket Reply, Broadcast & Cleanup
    admin_login = client.post(
        "/api/admin/login",
        json={
            "email": resolved_email,
            "password": resolved_password,
        },
    )
    assert admin_login.status_code == 200, admin_login.text
    admin_token = admin_login.json()["accessToken"]
    admin_csrf = admin_login.json()["csrfToken"]
    admin_headers = {
        "X-Admin-Authorization": f"Bearer {admin_token}",
        "X-Admin-CSRF-Token": admin_csrf,
    }

    reply_res = client.post(
        f"/api/admin/tickets/{ticket_id}/reply",
        headers=admin_headers,
        json={
            "reply": "Open Inventory and set the Low Stock Alert number on your item.",
            "status": "answered",
        },
    )
    assert reply_res.status_code == 200, reply_res.text

    broadcast_res = client.post(
        "/api/admin/broadcast",
        headers=admin_headers,
        json={
            "kind": "update",
            "title": "OjaFlow PWA Ready",
            "message": "Voice-to-Entry and offline mode are active.",
            "isActive": False,
        },
    )
    assert broadcast_res.status_code == 200, broadcast_res.text

    # Delete the test trader account so DB remains clean (0 users)
    del_res = client.delete(
        f"/api/admin/users/{uid}",
        headers=admin_headers,
    )
    assert del_res.status_code == 200, del_res.text


def test_ojaflow_production_suite(admin_credentials: tuple[str, str]) -> None:
    admin_email, admin_password = admin_credentials
    run_suite(admin_email, admin_password)


def test_settings_secret_fields_have_empty_defaults() -> None:
    sensitive_tokens = ("password", "secret", "key", "token")
    matched_fields = [
        name
        for name in Settings.model_fields
        if any(tok in name.lower() for tok in sensitive_tokens)
    ]
    assert matched_fields, "Expected at least one sensitive field on Settings."

    for field_name in matched_fields:
        default_val = Settings.model_fields[field_name].default
        assert default_val == "", (
            f"Settings.{field_name} must have an empty default, found non-empty value."
        )

    # Also verify production startup refuses an empty or short (<32 chars) session_secret
    with pytest.raises(ValueError, match="SESSION_SECRET"):
        Settings(app_env="production", session_secret="", _env_file=None)

    with pytest.raises(ValueError, match="SESSION_SECRET"):
        Settings(
            app_env="production", session_secret="short-secret-123", _env_file=None
        )


def test_admin_wrong_password_returns_401(admin_credentials: tuple[str, str]) -> None:
    admin_email, _ = admin_credentials
    client = TestClient(app)
    wrong_password = secrets.token_urlsafe(16)

    res = client.post(
        "/api/admin/login",
        json={"email": admin_email, "password": wrong_password},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid system administrator email or password."


def test_admin_repeated_wrong_passwords_trigger_lockout(
    admin_credentials: tuple[str, str],
) -> None:
    admin_email, admin_password = admin_credentials
    client = TestClient(app)
    wrong_password = secrets.token_urlsafe(16)

    for _ in range(5):
        # Clear in-memory rate limit buckets so we specifically test the DB lockout counter
        _rate_buckets.clear()
        res = client.post(
            "/api/admin/login",
            json={"email": admin_email, "password": wrong_password},
        )
        assert res.status_code == 401

    _rate_buckets.clear()
    locked_res = client.post(
        "/api/admin/login",
        json={"email": admin_email, "password": admin_password},
    )
    assert locked_res.status_code == 429
    assert "locked" in locked_res.json()["detail"].lower()
    assert "Retry-After" in locked_res.headers


def test_admin_login_rate_limit_applies(admin_credentials: tuple[str, str]) -> None:
    admin_email, _ = admin_credentials
    client = TestClient(app)
    wrong_password = secrets.token_urlsafe(16)

    # Reset DB lockout state before testing the per-email/per-IP rate limiter
    with Session(bind=engine) as session:
        admin = session.scalar(select(AdminUser).where(AdminUser.email == admin_email))
        if admin:
            admin.failed_login_attempts = 0
            admin.locked_until_epoch = None
            session.commit()

    _rate_buckets.clear()
    for _ in range(5):
        res = client.post(
            "/api/admin/login",
            json={"email": admin_email, "password": wrong_password},
        )
        assert res.status_code == 401

    rate_limited_res = client.post(
        "/api/admin/login",
        json={"email": admin_email, "password": wrong_password},
    )
    assert rate_limited_res.status_code == 429
    assert "Retry-After" in rate_limited_res.headers


def test_admin_disabled_and_routes_closed_when_env_missing(
    admin_credentials: tuple[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin_email, admin_password = admin_credentials
    client = TestClient(app)

    # First obtain a token while admin is enabled
    initial_login = client.post(
        "/api/admin/login",
        json={"email": admin_email, "password": admin_password},
    )
    assert initial_login.status_code == 200
    token = initial_login.json()["accessToken"]
    csrf = initial_login.json()["csrfToken"]
    headers = {
        "X-Admin-Authorization": f"Bearer {token}",
        "X-Admin-CSRF-Token": csrf,
    }

    # Now remove ADMIN_EMAIL and ADMIN_PASSWORD and re-run _seed_system_admin
    monkeypatch.setenv("ADMIN_EMAIL", "")
    monkeypatch.setenv("ADMIN_PASSWORD", "")
    get_settings.cache_clear()
    _rate_buckets.clear()
    _seed_system_admin(engine)

    with Session(bind=engine) as session:
        active_admins = session.scalars(
            select(AdminUser).where(AdminUser.is_active.is_(True))
        ).all()
        assert active_admins == []

    # Login must fail with 401
    login_attempt = client.post(
        "/api/admin/login",
        json={"email": admin_email, "password": admin_password},
    )
    assert login_attempt.status_code == 401

    # Protected admin routes must remain closed
    client.cookies.clear()
    for route in (
        "/api/admin/session",
        "/api/admin/overview",
        "/api/admin/users",
        "/api/admin/tickets",
    ):
        resp = client.get(route, headers=headers)
        assert resp.status_code in (401, 403)


def test_source_tree_holds_no_canonical_admin_names() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    target_Token = "CANONICAL_" + "ADMIN"
    default_Token = "DEFAULT_" + "ADMIN_"
    this_file = Path(__file__).resolve()

    for folder_name in ("backend", "src"):
        folder = repo_root / folder_name
        if not folder.exists():
            continue
        for file_path in folder.rglob("*"):
            if not file_path.is_file() or file_path.resolve() == this_file:
                continue
            if any(
                part
                in {"__pycache__", ".venv", "node_modules", ".pytest_cache", ".git"}
                for part in file_path.parts
            ):
                continue
            if file_path.suffix.lower() in {
                ".png",
                ".ico",
                ".woff2",
                ".db",
                ".sqlite3",
                ".pyc",
            }:
                continue
            text = file_path.read_text(encoding="utf-8", errors="ignore")
            assert target_Token not in text, f"Found forbidden token in {file_path}"
            assert default_Token not in text, (
                f"Found forbidden default admin constant in {file_path}"
            )


if __name__ == "__main__":
    run_suite()
