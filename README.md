<div align="center">

<img src="./public/ojaflow.svg" alt="OjaFlow Logo" width="110" />

# OjaFlow

### A trader-first business command centre for sales, inventory, expenses, debts, customers, invoices and practical business intelligence.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![Gemini](https://img.shields.io/badge/Gemini-OjaChat-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Netlify](https://img.shields.io/badge/Netlify-Frontend-00C7B7?logo=netlify&logoColor=white)](https://www.netlify.com/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-CRM-25D366?logo=whatsapp&logoColor=white)](https://www.whatsapp.com/)

**Web/PWA · Mobile-first · Phone-first authentication · Offline-aware**

</div>

---

## What OjaFlow Does

OjaFlow is designed for traders and small businesses that need a straightforward way to understand what is happening in their business without depending on notebooks or complex accounting software.

| Icon | Feature | Purpose |
| :---: | --- | --- |
| 📊 | Dashboard | Sales, expenses, gross profit, debts, customers and stock requiring attention |
| 📈 | Business analytics | Weekly, monthly and yearly sales/expense/profit tracking |
| 💰 | Sales | Record sales and payment methods |
| 💸 | Expenses | Track operating costs |
| 📦 | Inventory | Products, stock quantity, pricing and reorder levels |
| 🤝 | Debt & credit | Customer/supplier balances and repayments |
| 👥 | Customer CRM | Customer details, tags, purchase history, notes and debt relationship |
| 💬 | WhatsApp actions | Direct customer follow-up and business messages |
| 🧾 | Professional receipts | Print/save/share customer receipts |
| 📄 | Digital invoices | Multi-line invoices, due dates and payment status |
| 🤖 | OjaChat | Local store intelligence plus Gemini-powered business advice |
| 🌍 | Languages | English, Nigerian Pidgin, Yorùbá, Hausa and Igbo preference |
| ☁️ | Automatic cloud sync | Local-first records automatically synchronize with the OjaFlow API |
| 📤 | Export | JSON backup, CSV data and business summaries |
| 🔐 | Phone + password | OTP verifies sensitive phone ownership; ordinary login stays simple |
| 🆘 | Help & support | Support-ticket workflow |
| 🛠️ | Product notices | Scheduled development/maintenance announcements |

---

## Architecture

```mermaid
flowchart LR
    PWA[React + TypeScript PWA]
    API[FastAPI API]
    DB[(PostgreSQL)]
    OTP[Termii OTP]
    AI[Gemini API]
    LOCAL[(Local browser cache)]

    PWA <--> LOCAL
    PWA <--> API
    API <--> DB
    API --> OTP
    API --> AI
```

For fast local development, the backend defaults to **SQLite + console OTP**. Production switches to **PostgreSQL + Termii** through environment variables only.

---

## Authentication Flow

```text
Create Account
    ↓
Phone + Name + Password + Language
    ↓
FastAPI validates details
    ↓
OTP sent/created
    ↓
User enters 6-digit OTP
    ↓
Phone verified
    ↓
Password stored as Argon2 hash
    ↓
Secure HttpOnly session cookie
    ↓
Business setup
    ↓
Dashboard
```

Normal returning login uses **phone number + password**. OTP is reserved for registration, password recovery and destructive security-sensitive operations such as account deletion.

During local development, `OTP_PROVIDER=console` prints the OTP inside the FastAPI terminal so you can test the full flow without an SMS account.

For production, OjaFlow integrates with Termii's Token API.

---

## OjaChat

OjaChat has two layers:

1. **Local business intelligence** for questions that can be answered directly from OjaFlow records.
2. **Online business advice** through Gemini for pricing, customer retention, marketing, supplier negotiation, cash-flow habits and growth questions.

The Gemini API key exists only on the backend.

---

## Technology Stack

| Technology | Role |
| --- | --- |
| React 19 | Frontend UI |
| TypeScript | Type-safe frontend development |
| Vite | Frontend development/build tooling |
| Custom CSS | Responsive OjaFlow design system |
| Lucide React | Interface icons |
| Python | Backend language |
| FastAPI | REST API and session/authentication layer |
| SQLAlchemy 2 | Database ORM |
| PostgreSQL | Production cloud database |
| SQLite | Zero-setup local development database |
| pwdlib + Argon2 | Secure password hashing |
| PyJWT | Signed session/deletion tokens |
| Termii | Production SMS OTP delivery/verification |
| Gemini API | OjaChat online business adviser |
| Netlify | Frontend hosting and continuous deployment |
| Render/Railway-compatible API | FastAPI backend hosting |

---

## Project Structure

```text
OjaFlow/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── account.py
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── store.py
│   │   │   └── support.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── otp.py
│   │   ├── phone.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   └── serializers.py
│   ├── .env.example
│   └── requirements.txt
├── public/
│   ├── ojaflow.svg
│   └── manifest.webmanifest
├── src/
│   ├── components/
│   ├── config/
│   ├── lib/
│   ├── pages/
│   ├── App.tsx
│   ├── styles.css
│   └── types.ts
├── .env.example
├── package.json
├── netlify.toml
└── README.md
```

---

## Local Development

### 1. Backend

Open Terminal 1:

```powershell
cd backend
py -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API should be available at:

```text
http://localhost:8000/api/health
http://localhost:8000/docs
```

### 2. Frontend

Open Terminal 2 in the project root:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The frontend `.env` should contain:

```env
VITE_API_BASE_URL=/api
```

### 3. Local OTP

With backend:

```env
OTP_PROVIDER=console
```

create an account. The backend terminal will print something similar to:

```text
[OjaFlow DEV OTP] +2348012345678 -> 482913
```

Enter that six-digit code in OjaFlow.

---

## Production Environment

### Backend

```env
APP_ENV=production
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
FRONTEND_ORIGINS=https://your-site.netlify.app
SESSION_SECRET=generate-a-long-random-secret
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

OTP_PROVIDER=termii
TERMII_BASE_URL=https://YOUR_TERMII_BASE_URL
TERMII_API_KEY=YOUR_TERMII_API_KEY
TERMII_SENDER_ID=OjaFlow
TERMII_CHANNEL=generic

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.8-flash
```

### Frontend

```env
VITE_API_BASE_URL=/api

# Netlify environment variable used by the /api proxy:
OJAFLOW_API_ORIGIN=https://your-backend.example.com
```

Never place Termii, database, session or Gemini secrets inside frontend `VITE_` variables.

---

## Build

```powershell
npm run typecheck
npm run build
```

Production frontend output is generated in `dist/`.

---

## Before Public Release

- [ ] Registration succeeds with console OTP locally
- [ ] Phone + password login succeeds after logout
- [ ] Password recovery succeeds
- [ ] Business setup persists
- [ ] Sales/inventory/debt/customer/invoice data persists after refresh
- [ ] Automatic sync succeeds
- [ ] OjaChat local questions work
- [ ] Gemini online advice works when key is configured
- [ ] Receipts and invoices print/save correctly
- [ ] WhatsApp actions open correctly
- [ ] Data export works
- [ ] Account deletion requires password + OTP + final confirmation
- [ ] PostgreSQL production database is configured
- [ ] Termii real OTP is tested with a real Nigerian phone number
- [ ] HTTPS frontend/backend deployed
- [ ] Production CORS/cookie settings verified

---

## Author

**Wahab Opeyemi Badmus**  
Researcher · Developer · Builder  
Portfolio: [wahabbadmus.netlify.app](https://wahabbadmus.netlify.app)

---

<div align="center">

<img src="./public/ojaflow.svg" alt="OjaFlow" width="58" />

**Know your numbers. Understand your customers. Run your business with confidence.**

</div>
