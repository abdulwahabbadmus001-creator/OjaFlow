<div align="center">
  <img src="https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/main/public/logo.png" alt="OjaFlow Logo" width="120" height="120" />
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
   git clone [https://github.com/abdulwahabbadmus001-creator/OjaFlow.git](https://github.com/abdulwahabbadmus001-creator/OjaFlow.git)
   cd OjaFlow