<div align="center">
  <img src="https://raw.githubusercontent.com/abdulwahabbadmus001-creator/OjaFlow/main/public/ojaflow-of.svg" alt="OjaFlow Logo" width="120" height="120" />
  <h1>OjaFlow</h1>
  <p><strong>The Ultimate PWA Business Management & Financial Companion for Market Traders & SMEs</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge" alt="Status" />
    <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite%20PWA-blue?style=for-the-badge" alt="Frontend" />
    <img src="https://img.shields.io/badge/Backend-FastAPI%20%2B%20PostgreSQL-green?style=for-the-badge" alt="Backend" />
    <img src="https://img.shields.io/badge/Security-4--Digit%20PIN%20%2B%20Bcrypt-orange?style=for-the-badge" alt="Security" />
  </p>
</div>

---

## 🚀 About OjaFlow

**OjaFlow** is a production-grade, offline-first Progressive Web App (PWA) built specifically to solve daily operational challenges for market traders, micro-merchants, and SMEs across Africa. It eliminates the friction of traditional paper ledger books by providing lightning-fast sales logging, inventory control, debt tracking, and voice-enabled AI assistance—all secured behind a robust 4-digit PIN system.

---

## ✨ Key Features & Capabilities

- 🔐 **Secure 4-Digit PIN Authentication:** Fast, lightweight mobile-first auth secured with 12-round Bcrypt hashing and local recovery questions in multiple languages (Pidgin, Yorùbá, Hausa, Igbo, English).
- 🎙️ **Speech-to-Text Voice-to-Form Integration:** Built for busy market days where typing is hard—traders can speak naturally to record sales, check inventory, or chat with OjaChat in their preferred language.
- 📦 **Ticking Low-Stock Alarms:** Real-time visual alerts and blinking red notification badges whenever inventory items run low or hit zero stock.
- 💬 **OjaChat AI Assistant:** Interactive business assistant with auto-hiding suggestion chips that provide instant profit calculations, stock insights, and business tips.
- 🔒 **Private Admin Dashboard:** Hidden, highly secure administrator suite protected via environment variables (`ADMIN_EMAIL` & `ADMIN_PASSWORD`) to manage user accounts, unlock locked profiles, and review help & support tickets.
- ⚡ **Real-Time Support & Notifications:** Traders can submit help requests directly from the app, and admin replies appear instantly as notification banners on their personal screens.
- 📱 **Installable PWA & Offline Support:** Works seamlessly as a native mobile app installed straight from the browser, with offline queueing for fluctuating market network conditions.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, PWA Service Workers, Lucide Icons, Modern CSS.
- **Backend:** Python FastAPI, SQLAlchemy, PostgreSQL / SQLite, Pydantic.
- **Security:** HTTP-only JWT Sessions, Bcrypt, Rate Limiting.
- **Deployment:** Netlify (Frontend) & Render (Backend API).

---

## 📦 Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abdulwahabbadmus001-creator/OjaFlow.git
   cd OjaFlow
   ```

---

## 🧾 OjaProof Module (`/api/proof`)

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
| `PROOF_PUBLIC_BASE_URL` | `http://localhost:5173` | Public base URL of the deployed OjaProof frontend used for receipt verification links and QR codes. |

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
