# OjaFlow API

FastAPI backend for OjaFlow and the OjaProof receipt proof module. Local development defaults to SQLite and console OTP. Production can use PostgreSQL (Neon) and Termii without changing application code.

## Local start

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
pytest
uvicorn app.main:app --reload --port 8000
```

The current app registration form creates an account immediately through `/api/auth/register` and does not require SMS verification. This does not verify ownership of the supplied phone number, so configure a verified registration flow before exposing it in production. OTP-based recovery flows use the local console provider by default; their codes are printed in this backend terminal.

API docs: `http://localhost:8000/docs`
Health: `http://localhost:8000/api/health`

## OjaProof Module (`/api/proof`)

OjaProof is the digital receipt proof-of-transaction module built on top of OjaFlow (`backend/app/modules/proof/`). It reuses OjaFlow's existing 4-digit PIN authentication, SQLAlchemy session management, and security infrastructure while storing all data in `proof_`-prefixed tables (`proof_businesses`, `proof_customers`, `proof_receipts`, `proof_receipt_items`, `proof_deliveries`, `proof_audit_log`).

### Run & Test Commands

```powershell
cd backend
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PROOF_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins for the OjaProof frontend (merged with `FRONTEND_ORIGINS` and `http://localhost:5173`). |
| `PROOF_PUBLIC_BASE_URL` | `http://localhost:5173` | Public base URL of the deployed OjaProof frontend used for public receipt verification links and QR codes. |

### Endpoints

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/proof/receipts` | Required | Idempotently create a single receipt, assign sequential number (`PREFIX-YYYY-NNNNNN`), 8-char public code, and SHA-256 content hash. |
| `POST` | `/api/proof/receipts/sync` | Required | Batch sync up to 50 receipts using per-item savepoints. Returns `created`, `existing`, or `rejected` per item. |
| `GET` | `/api/proof/receipts` | Required | Paginated receipt list (`q`, `status`, `from`, `to`, `page`, `pageSize` max 50), newest first. |
| `GET` | `/api/proof/receipts/{id}` | Required | Get full receipt with line items and delivery history (`404` for unknown or foreign IDs). |
| `POST` | `/api/proof/receipts/{id}/void` | Required | Void a `valid` receipt with a reason (3–300 chars) and write an audit log entry (`409` on second void). |
| `POST` | `/api/proof/receipts/{id}/deliveries` | Required | Record a receipt delivery/share action (`whatsapp`, `gmail`, `call`, `copy`). |
| `GET` | `/api/proof/customers` | Required | Paginated customer search (`q`, `page`, `pageSize`). |
| `POST` | `/api/proof/customers` | Required | Create or upsert a customer for the current business. |
| `PUT` | `/api/proof/customers/{id}` | Required | Update an existing customer owned by the current business. |
| `GET` | `/api/proof/business` | Required | Get (or auto-create) the current user's OjaProof business profile. |
| `PUT` | `/api/proof/business` | Required | Update business details (`name`, `phone`, `email`, `address`, `logoData` max 200 KB, `receiptPrefix` 2–6 uppercase chars/digits). |
| `GET` | `/api/proof/reports/summary` | Required | Financial summary (`period` = `day`, `week`, or `month`, optional `date`) with per-day series, excluding voided receipts from totals. |
| `GET` | `/api/proof/verify/{code}` | Public | Public verification endpoint (rate-limited to 60 req/min/IP). Recomputes SHA-256 content hash, omits private contact details/notes/internal IDs, and returns `404` with `found: false` for unknown codes. |

### Render Deployment Notes

1. Open your OjaFlow backend service in the **Render Dashboard** -> **Environment**.
2. Add the new environment variables:
   - `PROOF_ALLOWED_ORIGINS`: Set to your deployed OjaProof Netlify URL (e.g. `https://ojaproof.netlify.app`).
   - `PROOF_PUBLIC_BASE_URL`: Set to your deployed OjaProof Netlify URL (e.g. `https://ojaproof.netlify.app`).
   - Ensure `APP_ENV=production` and `COOKIE_SECURE=true` so the HTTP-only session cookie is issued with `SameSite=None; Secure` for cross-domain requests between Netlify and Render.
3. Trigger a redeploy on Render and verify `/docs` on the live URL.

## Support requests

Submitted support requests are saved in the `support_tickets` table and linked
to the user's account. The app displays the ticket reference after a successful
submission, but does not currently include a staff inbox or show replies.

For a local SQLite run started from this directory, the database is
`ojaflow.db`. Open it with a SQLite viewer and run:

```sql
SELECT id, user_id, category, subject, message, status, created_at
FROM support_tickets
ORDER BY created_at DESC;
```

For a deployed environment, run the same query against the database configured
by `DATABASE_URL`. Restrict database access to authorised support staff because
ticket messages may contain personal or business information.
