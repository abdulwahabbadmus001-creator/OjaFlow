from collections.abc import Generator
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event, update
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.migrations import ensure_proof_schema
from backend.app.models import StoreState, User
from backend.app.modules.proof.models import ProofReceiptItem
from backend.app.modules.proof.security import reset_verify_rate_limits
from backend.app.security import (
    _rate_buckets,
    create_session_token,
    hash_password,
    hash_security_answer,
)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    ensure_proof_schema(engine)
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    def _override_get_db() -> Generator[Session, None, None]:
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    _rate_buckets.clear()
    reset_verify_rate_limits()

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.clear()
        reset_verify_rate_limits()


def _create_user_and_headers(
    db: Session,
    phone: str,
    first_name: str = "Tunde",
    last_name: str = "Bakare",
) -> tuple[User, dict[str, str]]:
    user = User(
        id=str(uuid4()),
        phone=phone,
        oja_tag=f"OJA-{uuid4().hex[:5].upper()}",
        first_name=first_name,
        last_name=last_name,
        preferred_language="en",
        password_hash=hash_password("1234"),
        security_question="What is your business nickname or popular shop alias?",
        security_answer_hash=hash_security_answer("Balogun"),
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(StoreState(user_id=user.id))
    db.commit()
    db.refresh(user)

    token, csrf = create_session_token(user)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-CSRF-Token": csrf,
    }
    return user, headers


def test_idempotent_create_same_receipt_id_twice_returns_one_record(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111111")
    client = TestClient(app)

    receipt_id = str(uuid4())
    payload = {
        "id": receipt_id,
        "recordType": "sale",
        "customerName": "Chinedu Okafor",
        "customerPhone": "+2348022223333",
        "customerEmail": "chinedu@example.com",
        "items": [
            {
                "description": "50kg Bag of Parboiled Rice",
                "serialNumber": "SN-001",
                "quantity": 2,
                "unitPriceKobo": 7500000,
            }
        ],
        "discountKobo": 500000,
        "amountPaidKobo": 14500000,
        "paymentMethod": "transfer",
        "notes": "Delivered to shop",
    }

    res1 = client.post("/api/proof/receipts", json=payload, headers=headers)
    assert res1.status_code == 200, res1.text
    body1 = res1.json()
    assert body1["id"] == receipt_id
    assert body1["syncStatus"] == "created"

    res2 = client.post("/api/proof/receipts", json=payload, headers=headers)
    assert res2.status_code == 200, res2.text
    body2 = res2.json()
    assert body2["id"] == receipt_id
    assert body2["number"] == body1["number"]
    assert body2["publicCode"] == body1["publicCode"]
    assert body2["syncStatus"] == "existing"

    list_res = client.get("/api/proof/receipts", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1


def test_sequential_unique_numbers_across_batch_of_20(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111112")
    client = TestClient(app)

    batch = [
        {
            "id": str(uuid4()),
            "recordType": "sale",
            "customerName": f"Customer {i + 1}",
            "items": [
                {
                    "description": f"Product {i + 1}",
                    "serialNumber": "",
                    "quantity": 1,
                    "unitPriceKobo": 100000 * (i + 1),
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 100000 * (i + 1),
            "paymentMethod": "cash",
            "issuedAt": "2026-11-14T08:00:00Z",
        }
        for i in range(20)
    ]

    res = client.post(
        "/api/proof/receipts/sync",
        json={"receipts": batch},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    results = res.json()["results"]
    assert len(results) == 20

    numbers = [item["number"] for item in results]
    public_codes = [item["publicCode"] for item in results]
    expected_numbers = [f"OP-2026-{seq:06d}" for seq in range(1, 21)]

    assert numbers == expected_numbers
    assert len(set(numbers)) == 20
    assert len(set(public_codes)) == 20


def test_tenant_isolation_second_user_cannot_read_void_or_list_first_user_receipts(
    db_session: Session,
) -> None:
    _, headers1 = _create_user_and_headers(
        db_session,
        "+2348011111113",
        first_name="UserOne",
    )
    _, headers2 = _create_user_and_headers(
        db_session,
        "+2348011111114",
        first_name="UserTwo",
    )
    client = TestClient(app)

    receipt_id = str(uuid4())
    create_res = client.post(
        "/api/proof/receipts",
        headers=headers1,
        json={
            "id": receipt_id,
            "recordType": "sale",
            "customerName": "Tenant One Buyer",
            "items": [
                {
                    "description": "Generator Inverter",
                    "serialNumber": "GEN-99",
                    "quantity": 1,
                    "unitPriceKobo": 25000000,
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 25000000,
            "paymentMethod": "pos",
        },
    )
    assert create_res.status_code == 200

    # User 2 cannot list User 1's receipts
    list_res = client.get("/api/proof/receipts", headers=headers2)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 0
    assert list_res.json()["items"] == []

    # User 2 gets 404 (not 403) when trying to read User 1's receipt
    get_res = client.get(f"/api/proof/receipts/{receipt_id}", headers=headers2)
    assert get_res.status_code == 404
    assert get_res.json()["error"]["code"] == "RECEIPT_NOT_FOUND"

    # User 2 gets 404 (not 403) when trying to void User 1's receipt
    void_res = client.post(
        f"/api/proof/receipts/{receipt_id}/void",
        headers=headers2,
        json={"reason": "Unauthorized void attempt"},
    )
    assert void_res.status_code == 404
    assert void_res.json()["error"]["code"] == "RECEIPT_NOT_FOUND"


def test_server_recomputes_totals_when_client_sends_wrong_totals(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111115")
    client = TestClient(app)

    res = client.post(
        "/api/proof/receipts",
        headers=headers,
        json={
            "id": str(uuid4()),
            "recordType": "sale",
            "customerName": "Funke Akindele",
            "items": [
                {
                    "description": "Carton of Indomie",
                    "serialNumber": "",
                    "quantity": 3,
                    "unitPriceKobo": 850000,
                    "lineTotalKobo": 100,
                },
                {
                    "description": "Vegetable Oil 5L",
                    "serialNumber": "",
                    "quantity": 2,
                    "unitPriceKobo": 1200000,
                    "lineTotalKobo": 200,
                },
            ],
            "subtotalKobo": 300,
            "discountKobo": 150000,
            "totalKobo": 150,
            "amountPaidKobo": 4800000,
            "paymentMethod": "cash",
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()

    # True math: (3 * 850_000) + (2 * 1_200_000) = 2_550_000 + 2_400_000 = 4_950_000
    # Total = 4_950_000 - 150_000 = 4_800_000
    assert body["subtotalKobo"] == 4950000
    assert body["discountKobo"] == 150000
    assert body["totalKobo"] == 4800000
    assert body["items"][0]["lineTotalKobo"] == 2550000
    assert body["items"][1]["lineTotalKobo"] == 2400000


def test_verify_returns_hash_valid_true_and_false_after_db_tamper(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111116")
    client = TestClient(app)

    receipt_id = str(uuid4())
    create_res = client.post(
        "/api/proof/receipts",
        headers=headers,
        json={
            "id": receipt_id,
            "recordType": "sale",
            "customerName": "Ibrahim Musa",
            "items": [
                {
                    "description": "iPhone 15 Pro",
                    "serialNumber": "IMEI-35991100",
                    "quantity": 1,
                    "unitPriceKobo": 150000000,
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 150000000,
            "paymentMethod": "transfer",
        },
    )
    assert create_res.status_code == 200
    public_code = create_res.json()["publicCode"]

    # Fresh receipt verifies with hashValid = True
    verify_res = client.get(f"/api/proof/verify/{public_code}")
    assert verify_res.status_code == 200
    assert verify_res.headers.get("Cache-Control") == "no-store"
    assert verify_res.headers.get("X-Content-Type-Options") == "nosniff"
    v_body = verify_res.json()
    assert v_body["found"] is True
    assert v_body["hashValid"] is True
    assert v_body["totalKobo"] == 150000000

    # Tamper directly with the item price in the database
    db_session.execute(
        update(ProofReceiptItem)
        .where(ProofReceiptItem.receipt_id == receipt_id)
        .values(unit_price_kobo=99900000)
    )
    db_session.commit()

    verify_tampered = client.get(f"/api/proof/verify/{public_code}")
    assert verify_tampered.status_code == 200
    assert verify_tampered.json()["found"] is True
    assert verify_tampered.json()["hashValid"] is False


def test_voiding_keeps_hash_valid_true_and_changes_status(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111117")
    client = TestClient(app)

    receipt_id = str(uuid4())
    create_res = client.post(
        "/api/proof/receipts",
        headers=headers,
        json={
            "id": receipt_id,
            "recordType": "service",
            "customerName": "Sadiq Abubakar",
            "items": [
                {
                    "description": "AC Installation Service",
                    "serialNumber": "",
                    "quantity": 1,
                    "unitPriceKobo": 3500000,
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 3500000,
            "paymentMethod": "cash",
        },
    )
    assert create_res.status_code == 200
    public_code = create_res.json()["publicCode"]

    void_res = client.post(
        f"/api/proof/receipts/{receipt_id}/void",
        headers=headers,
        json={"reason": "Duplicate entry created by mistake"},
    )
    assert void_res.status_code == 200, void_res.text
    void_body = void_res.json()
    assert void_body["status"] == "voided"
    assert void_body["voidReason"] == "Duplicate entry created by mistake"
    assert void_body["voidedAt"] is not None

    # A second void returns 409
    void_again = client.post(
        f"/api/proof/receipts/{receipt_id}/void",
        headers=headers,
        json={"reason": "Second void attempt"},
    )
    assert void_again.status_code == 409
    assert void_again.json()["error"]["code"] == "RECEIPT_ALREADY_VOIDED"

    # Verify shows status=voided and hashValid=True
    verify_res = client.get(f"/api/proof/verify/{public_code}")
    assert verify_res.status_code == 200
    v_body = verify_res.json()
    assert v_body["found"] is True
    assert v_body["status"] == "voided"
    assert v_body["voidReason"] == "Duplicate entry created by mistake"
    assert v_body["hashValid"] is True


def test_verify_response_never_contains_phone_or_email(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111118")
    client = TestClient(app)

    client.put(
        "/api/proof/business",
        headers=headers,
        json={
            "name": "Kano Electronics Hub",
            "phone": "+2348099990000",
            "email": "secret-owner@kanohub.ng",
            "address": "44 Zoo Road, Kano",
            "logoData": "data:image/png;base64,iVBORw0KGgo=",
            "receiptPrefix": "KEH",
        },
    )

    create_res = client.post(
        "/api/proof/receipts",
        headers=headers,
        json={
            "id": str(uuid4()),
            "recordType": "sale",
            "customerName": "Ngozi Eze",
            "customerPhone": "+2348033334444",
            "customerEmail": "ngozi.private@example.com",
            "items": [
                {
                    "description": "Deep Freezer 200L",
                    "serialNumber": "DF-200-XYZ",
                    "quantity": 1,
                    "unitPriceKobo": 32000000,
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 32000000,
            "paymentMethod": "transfer",
            "notes": "Private delivery instruction: gate code 4821",
        },
    )
    assert create_res.status_code == 200
    public_code = create_res.json()["publicCode"]

    verify_res = client.get(f"/api/proof/verify/{public_code}")
    assert verify_res.status_code == 200
    raw_text = verify_res.text
    v_body = verify_res.json()

    forbidden_keys = {
        "customerPhone",
        "customer_phone",
        "customerEmail",
        "customer_email",
        "phone",
        "email",
        "notes",
        "address",
        "id",
        "businessId",
        "business_id",
        "ownerUserId",
    }
    assert forbidden_keys.isdisjoint(v_body.keys())
    assert "+2348033334444" not in raw_text
    assert "ngozi.private@example.com" not in raw_text
    assert "+2348099990000" not in raw_text
    assert "secret-owner@kanohub.ng" not in raw_text
    assert "44 Zoo Road" not in raw_text
    assert "gate code 4821" not in raw_text

    # Unknown code returns 404 with found: False
    missing_res = client.get("/api/proof/verify/ABCDEFGH")
    assert missing_res.status_code == 404
    assert missing_res.json()["found"] is False


def test_sync_processes_mixed_batch_where_one_item_is_invalid_and_others_succeed(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111119")
    client = TestClient(app)

    valid_id_1 = str(uuid4())
    invalid_id_2 = str(uuid4())
    valid_id_3 = str(uuid4())

    batch = [
        {
            "id": valid_id_1,
            "recordType": "sale",
            "customerName": "Valid Customer One",
            "items": [
                {
                    "description": "Solar Panel 300W",
                    "serialNumber": "SP-300",
                    "quantity": 2,
                    "unitPriceKobo": 9500000,
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 19000000,
            "paymentMethod": "transfer",
        },
        {
            "id": invalid_id_2,
            "recordType": "sale",
            "customerName": "Invalid Discount Customer",
            "items": [
                {
                    "description": "Small Cable",
                    "serialNumber": "",
                    "quantity": 1,
                    "unitPriceKobo": 50000,
                }
            ],
            # Invalid: discountKobo exceeds subtotalKobo
            "discountKobo": 900000,
            "amountPaidKobo": 0,
            "paymentMethod": "cash",
        },
        {
            "id": valid_id_3,
            "recordType": "purchase",
            "customerName": "Valid Supplier Three",
            "items": [
                {
                    "description": "Inverter Battery 200Ah",
                    "serialNumber": "BAT-200",
                    "quantity": 1,
                    "unitPriceKobo": 28000000,
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 20000000,
            "paymentMethod": "credit",
        },
    ]

    sync_res = client.post(
        "/api/proof/receipts/sync",
        headers=headers,
        json={"receipts": batch},
    )
    assert sync_res.status_code == 200, sync_res.text
    results = sync_res.json()["results"]
    assert len(results) == 3

    assert results[0]["id"] == valid_id_1
    assert results[0]["status"] == "created"
    assert results[0]["number"] is not None
    assert results[0]["publicCode"] is not None
    assert results[0]["error"] is None

    assert results[1]["id"] == invalid_id_2
    assert results[1]["status"] == "rejected"
    assert results[1]["number"] is None
    assert results[1]["publicCode"] is None
    assert results[1]["error"] is not None

    assert results[2]["id"] == valid_id_3
    assert results[2]["status"] == "created"
    assert results[2]["number"] is not None
    assert results[2]["publicCode"] is not None
    assert results[2]["error"] is None

    # Verify only the 2 valid receipts exist in the database
    list_res = client.get("/api/proof/receipts", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 2

    # Check reports summary excludes voided receipts and calculates totals properly
    report_res = client.get(
        "/api/proof/reports/summary?period=month",
        headers=headers,
    )
    assert report_res.status_code == 200, report_res.text
    summary = report_res.json()
    assert summary["totalSalesKobo"] == 19000000
    assert summary["totalPurchasesKobo"] == 28000000
    assert summary["receiptCount"] == 2
    assert summary["voidedCount"] == 0
    assert summary["amountPaidKobo"] == 39000000
    assert summary["outstandingBalanceKobo"] == 8000000


def test_customers_deliveries_and_verify_rate_limit(
    db_session: Session,
) -> None:
    _, headers = _create_user_and_headers(db_session, "+2348011111120")
    client = TestClient(app)

    receipt_id = str(uuid4())
    create_res = client.post(
        "/api/proof/receipts",
        headers=headers,
        json={
            "id": receipt_id,
            "recordType": "sale",
            "customerName": "Bola Ahmed",
            "customerPhone": "+2348055556666",
            "customerEmail": "bola@example.com",
            "items": [
                {
                    "description": "POS Terminal",
                    "serialNumber": "POS-778",
                    "quantity": 1,
                    "unitPriceKobo": 4500000,
                }
            ],
            "discountKobo": 0,
            "amountPaidKobo": 4500000,
            "paymentMethod": "pos",
        },
    )
    assert create_res.status_code == 200
    public_code = create_res.json()["publicCode"]

    # Customer was auto-upserted from receipt creation
    cust_list = client.get("/api/proof/customers?q=Bola", headers=headers)
    assert cust_list.status_code == 200
    assert cust_list.json()["total"] == 1
    cust_id = cust_list.json()["items"][0]["id"]

    # Update customer
    cust_upd = client.put(
        f"/api/proof/customers/{cust_id}",
        headers=headers,
        json={
            "name": "Bola Ahmed Updated",
            "phone": "+2348055556666",
            "email": "bola.updated@example.com",
        },
    )
    assert cust_upd.status_code == 200
    assert cust_upd.json()["name"] == "Bola Ahmed Updated"

    # Log delivery
    deliv_res = client.post(
        f"/api/proof/receipts/{receipt_id}/deliveries",
        headers=headers,
        json={"channel": "whatsapp"},
    )
    assert deliv_res.status_code == 200
    assert deliv_res.json()["channel"] == "whatsapp"

    detail_res = client.get(
        f"/api/proof/receipts/{receipt_id}",
        headers=headers,
    )
    assert detail_res.status_code == 200
    assert len(detail_res.json()["deliveries"]) == 1

    # Rate limit on verify: 60 allowed per minute, 61st returns 429
    reset_verify_rate_limits()
    for _ in range(60):
        r = client.get(f"/api/proof/verify/{public_code}")
        assert r.status_code == 200
    r_limited = client.get(f"/api/proof/verify/{public_code}")
    assert r_limited.status_code == 429
    assert r_limited.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"

