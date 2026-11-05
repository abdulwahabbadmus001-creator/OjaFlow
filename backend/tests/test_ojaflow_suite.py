from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.app.database import engine
from backend.app.main import app
from backend.app.models import (
    Business,
    OtpChallenge,
    StoreState,
    SupportTicket,
    User,
    UserNotification,
)
from backend.app.security import _rate_buckets

TEST_PHONE = "+2348099887766"


def _cleanup_test_user() -> None:
    _rate_buckets.clear()
    with Session(bind=engine) as session:
        user = session.scalar(select(User).where(User.phone == TEST_PHONE))
        if user:
            session.execute(
                delete(UserNotification).where(
                    UserNotification.user_id == user.id
                )
            )
            session.execute(
                delete(SupportTicket).where(SupportTicket.user_id == user.id)
            )
            session.execute(
                delete(OtpChallenge).where(OtpChallenge.user_id == user.id)
            )
            session.execute(
                delete(StoreState).where(StoreState.user_id == user.id)
            )
            session.execute(
                delete(Business).where(Business.user_id == user.id)
            )
            session.execute(delete(User).where(User.id == user.id))
        session.commit()


def run_suite() -> None:
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
            "phone": "+2348099887766",
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
            "email": "adminwbadmus@ojaflow.com",
            "password": "OjaFlowAdmin007$$",
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

    print("ALL 7 OJAFLOW PRODUCTION SUITE CHECKS PASSED!")


if __name__ == "__main__":
    run_suite()
