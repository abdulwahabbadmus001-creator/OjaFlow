# OjaProof Backend Module — Build Progress

## Inspection Findings (Step 1)

- **FastAPI App Entry**: `backend/app/main.py` initializes `app = FastAPI(title=settings.app_name, version="1.2.0")`, attaches `CORSMiddleware` and `security_headers_middleware`, and mounts routers under `/api`.
- **SQLAlchemy Base & Session Dependency**: `backend/app/database.py` defines `Base(DeclarativeBase)`, `engine`, `SessionLocal`, and `get_db() -> Generator[Session, None, None]`. Primary keys across `backend/app/models.py` are `String(36)` UUID strings (`uuid_str()`), and timestamps use `DateTime(timezone=True)` in UTC (`now_utc()`).
- **Current User Dependency**: `backend/app/security.py` provides `AuthContext` and `current_auth(request: Request, db: Session = Depends(get_db)) -> AuthContext`, supporting both `ojaflow_session` HTTP-only JWT cookies and `Authorization: Bearer <token>` headers.
- **Settings / Config Pattern**: `backend/app/config.py` uses `pydantic_settings.BaseSettings` (`Settings`) cached via `@lru_cache def get_settings() -> Settings`, loading `.env` and `backend/.env`.
- **CORS & Session Cookie Setup**:
  - `Settings.origins` parses comma-separated origins from `FRONTEND_ORIGINS` (to be extended with `PROOF_ALLOWED_ORIGINS` and `http://localhost:5173`).
  - `set_session_cookie` / `clear_session_cookie` in `backend/app/security.py` set `ojaflow_session`. In production (`APP_ENV=production`), cross-domain deployments (Netlify frontend + Render API) require `SameSite=None` and `Secure=True`.
- **Rate Limiting Approach**: `backend/app/security.py` implements thread-safe sliding-window rate limiting using `_rate_lock`, `_rate_buckets` (`dict[str, deque[float]]`), and `client_ip(request)`.
- **Migration Approach**: `backend/app/main.py` runs `Base.metadata.create_all(bind=engine)` and `ensure_ojatag_schema(engine)` from `backend/app/migrations.py`. New `proof_` tables will be created via `Base.metadata.create_all` plus a non-destructive `ensure_proof_schema(engine)` helper for indexes (including lowercase `customer_name` index).
- **Test Setup**: `backend/tests/` uses `fastapi.testclient.TestClient`. We will add `pytest` to `backend/requirements.txt`, configure `backend/conftest.py` so imports work whether `pytest` is run from `backend/` or the repo root, and write `backend/tests/test_proof.py` using isolated SQLite in-memory/test sessions.

## Build Steps Checklist

- [x] **Step 1 — Inspect the repo and write findings to `PROOF_PROGRESS.md`**
  - Files changed: `PROOF_PROGRESS.md`
- [x] **Step 2 — Models, database tables and migration or table creation**
  - Files changed: `backend/app/modules/__init__.py`, `backend/app/modules/proof/__init__.py`, `backend/app/modules/proof/models.py`, `backend/app/migrations.py`, `PROOF_PROGRESS.md`
  - Choices noted: Used `String(36)` primary keys and `DateTime(timezone=True)` (`now_utc`) matching `backend/app/models.py`. Used `BigInteger` for kobo columns so large kobo values up to `100_000_000_000` work on both PostgreSQL and SQLite. Normalized absent customer phones to `NULL` in `proof_customers.phone` so `UNIQUE(business_id, phone)` permits multiple phone-less customers while enforcing uniqueness when phone is present. Added composite indexes `(business_id, issued_at)`, `(business_id, status)`, `(public_code)` and `lower(customer_name)` expression index in `ensure_proof_schema`.
- [x] **Step 3 — Schemas, validation and utilities (money, numbering, public code, hash)**
  - Files changed: `backend/app/modules/proof/utils.py`, `backend/app/modules/proof/schemas.py`, `PROOF_PROGRESS.md`
  - Choices noted: Implemented `CamelModel` with `alias_generator=to_camel` and `populate_by_name=True`. Server recomputes `line_total_kobo`, `subtotal_kobo`, and `total_kobo` in `compute_receipt_totals` and ignores client-supplied totals. Used `SyncReceiptsRequest` with `list[dict[str, Any]]` (max 50) so per-item validation happens inside individual savepoints during batch sync without failing the entire batch when one item is invalid. Canonical SHA-256 content hash follows exact fixed field order (`business_id`, `receipt_id`, `number`, `record_type`, `customer_name`, `currency`, `issued_at`, `items`, `discount_kobo`, `total_kobo`).
- [x] **Step 4 — Service layer with transactions**
  - Files changed: `backend/app/modules/proof/service.py`, `PROOF_PROGRESS.md`
  - Choices noted: Used PostgreSQL `SELECT ... FOR UPDATE` (`with_for_update()`) on `ProofBusiness` and a thread-safe SQLite lock fallback (`_sqlite_seq_lock`) for atomic sequential numbering (`PREFIX-YYYY-NNNNNN`). Used `db.begin_nested()` (SQLAlchemy savepoint) per item in `sync_receipts` so invalid items return `status="rejected"` without blocking valid items in the batch. Enforced strict tenant isolation by filtering every lookup by `business_id` and returning `404` (`RECEIPT_NOT_FOUND` / `CUSTOMER_NOT_FOUND`) for foreign IDs.
- [x] **Step 5 — Router, registration, error format, CORS and rate limiting**
  - Files changed: `backend/app/modules/proof/security.py`, `backend/app/modules/proof/router.py`, `backend/app/config.py`, `backend/app/security.py`, `backend/app/main.py`, `backend/.env.example`, `.env.example`, `.gitignore`, `PROOF_PROGRESS.md`
  - Choices noted: Registered `/api/proof` router in `backend/app/main.py`. Added `PROOF_ALLOWED_ORIGINS` and `PROOF_PUBLIC_BASE_URL` to `Settings`, merging `PROOF_ALLOWED_ORIGINS` and `http://localhost:5173` into `Settings.origins`. Updated `set_session_cookie` and `clear_session_cookie` in `backend/app/security.py` to set `SameSite=None` and `Secure=True` in production (`APP_ENV=production`) for cross-domain cookie delivery. Added consistent `{ "error": { "code", "message" } }` exception handlers for `/api/proof` routes, 1 MB request body limit, 60 req/min/IP sliding-window rate limiter on `/api/proof/verify/{code}`, and `Cache-Control: no-store` + `X-Content-Type-Options: nosniff` headers on verification responses. Added `ojaflow.db` to `.gitignore`.
- [x] **Step 6 — Reports and customers and business endpoints**
  - Files changed: `backend/app/modules/proof/service.py`, `backend/app/modules/proof/router.py`, `backend/app/modules/proof/schemas.py`, `PROOF_PROGRESS.md`
  - Choices noted: Implemented `GET/POST /api/proof/customers`, `PUT /api/proof/customers/{id}`, `GET/PUT /api/proof/business` (supporting both `logoData` and `logoBase64` aliases, max 200 KB, and 2–6 uppercase alphanumeric `receiptPrefix`), and `GET /api/proof/reports/summary` (`period` in `day`, `week`, `month`, optional `date`, excluding voided receipts from monetary totals and returning a chronological per-day `series`).
- [x] **Step 7 — Tests, then run pytest and fix failures**
  - Files changed: `backend/conftest.py`, `backend/tests/test_proof.py`, `backend/requirements.txt`, `PROOF_PROGRESS.md`
  - Choices noted: Added `pytest>=8.0.0` to `backend/requirements.txt`, created `backend/conftest.py` for clean module resolution, and wrote 9 comprehensive pytest tests in `backend/tests/test_proof.py` using an isolated in-memory SQLite database via `app.dependency_overrides[get_db]`. Covered idempotency, 20-receipt sequential numbering, cross-tenant 404 isolation, server-side kobo total recomputation, SHA-256 content hash tamper detection, voiding (`hashValid=True` + `409` on second void), zero PII leakage on `/verify/{code}`, mixed-batch savepoint sync, customers/deliveries/reports, and 60 req/min rate limiting.
- [x] **Step 8 — README section for OjaProof with run commands, environment variables, a table of endpoints and Render deployment notes**
  - Files changed: `backend/README.md`, `README.md`, `PROOF_PROGRESS.md`
  - Choices noted: Documented local setup and test commands, `PROOF_ALLOWED_ORIGINS` and `PROOF_PUBLIC_BASE_URL` environment variables, full `/api/proof` endpoint table, and Render cross-domain deployment notes.
