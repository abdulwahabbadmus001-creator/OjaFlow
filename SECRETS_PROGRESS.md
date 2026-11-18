# OjaFlow Admin Backdoor & Hardcoded Secrets Removal — Progress

> **Security Rule:** No secret values are recorded anywhere in this file, code, logs, or reports.

---

## Steps Checklist

- [x] **Step 0 — Create branch `fix/remove-admin-backdoor` and initialize `SECRETS_PROGRESS.md`**
  - Files changed: `SECRETS_PROGRESS.md`
- [x] **Step 1 — Config (`backend/app/config.py`)**
  - Files changed: `backend/app/config.py`
  - Decisions:
    - Set default values of `admin_email`, `admin_password`, and `session_secret` to `""`.
    - Verified every `Settings` field containing `password`, `secret`, `key`, or `token` (`session_secret`, `admin_password`, `whatsapp_access_token`, `termii_api_key`, `gemini_api_key`) has an empty string default `""`.
    - Added a `@model_validator(mode="after")` on `Settings` that refuses to start when `app_env` is `"production"` and `session_secret` is empty or shorter than 32 characters.
- [x] **Step 2 — Remove the Built-In Password (`backend/app/security.py`, `backend/app/routers/admin.py`, `backend/app/migrations.py`)**
  - Files changed: `backend/app/security.py`, `backend/app/routers/admin.py`, `backend/app/migrations.py`
  - Decisions:
    - Deleted `CANONICAL_ADMIN_EMAIL` and `CANONICAL_ADMIN_PASSWORD` from `backend/app/security.py` and `backend/app/routers/admin.py`.
    - Updated `is_valid_admin_email(email, db)` in `backend/app/security.py` to check the configured `settings.admin_email` or an active `AdminUser` row in the database.
    - Updated `admin_login` in `backend/app/routers/admin.py` to delete `matches_canonical_pair`, `direct_owner_match`, trailing-`$` stripping, hash-overwriting on login, and all rate-limit/lockout bypasses. Every login now strictly executes: rate limit -> email check -> load `AdminUser` row -> lockout check -> Bcrypt verify -> record success or failure, returning a single generic error message (`GENERIC_ADMIN_AUTH_ERROR`) for all authentication failures.
    - Deleted `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` from `backend/app/migrations.py`. Updated `_seed_system_admin` so that when `ADMIN_EMAIL` is set and `ADMIN_PASSWORD` has 12+ characters, the database hash is created/updated from the environment; when either is missing or `ADMIN_PASSWORD` is shorter than 12 characters, all `AdminUser` rows are set to `is_active = False`, one warning is logged without secret values, and no admin row is created.
- [x] **Step 3 — Find and Remove Old Password Text & Hardcoded Emails/Tokens/Keys (`backend/.env`, `backend/.env.example`, `.env.example`, `src/pages/AdminPage.tsx`)**
  - Files changed: `backend/app/config.py`, `backend/app/migrations.py`, `backend/app/security.py`, `backend/tests/test_ojaflow_suite.py`, `backend/.env`, `backend/.env.example`, `.env.example`, `src/pages/AdminPage.tsx`
  - Occurrences found and removed (file names and line numbers only):
    - Old default password / single-`$` variant:
      - `backend/.env:23`
      - `backend/app/config.py:24`
      - `backend/app/migrations.py:151`
      - `backend/app/security.py:531`
      - `backend/tests/test_ojaflow_suite.py:157`
    - Old default admin email / session secret:
      - `backend/.env:22`
      - `backend/.env.example:7`
      - `backend/app/config.py:16`, `backend/app/config.py:23`
      - `backend/app/migrations.py:150`
      - `backend/app/security.py:530`
      - `backend/tests/test_ojaflow_suite.py:156`
      - `src/pages/AdminPage.tsx:341` (moved to `VITE_ADMIN_EMAIL_PLACEHOLDER` with an empty default in `.env.example`)
- [x] **Step 4 — Tests (`backend/tests/test_ojaflow_suite.py`)**
  - Files changed: `backend/tests/test_ojaflow_suite.py`
  - Decisions:
    - Replaced hardcoded admin credentials with runtime-generated values via `secrets.token_hex` and `secrets.token_urlsafe` inside the `admin_credentials` pytest fixture and module bootstrap.
    - Added tests verifying:
      - Wrong admin password returns HTTP `401` (`test_admin_wrong_password_returns_401`)
      - Repeated wrong passwords trigger `AdminUser` lockout (`429`, `test_admin_repeated_wrong_passwords_trigger_lockout`)
      - Per-email/IP rate limiting applies (`429`, `test_admin_login_rate_limit_applies`)
      - Missing `ADMIN_EMAIL` / `ADMIN_PASSWORD` deactivates `AdminUser` rows, fails login (`401`), and keeps `/api/admin/*` routes closed (`test_admin_disabled_and_routes_closed_when_env_missing`)
      - The source tree contains no `CANONICAL_ADMIN` or `DEFAULT_ADMIN_` identifiers (`test_source_tree_holds_no_canonical_admin_names`)
      - Every `Settings` field containing `password`, `secret`, `key`, or `token` has an empty default `""` and production refuses to start with an empty or `<32`-char `SESSION_SECRET` (`test_settings_secret_fields_have_empty_defaults`)
- [x] **Step 5 — Docs (`README.md`)**
  - Files changed: `README.md`, `SECRETS_PROGRESS.md`
  - Decisions:
    - Documented `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `README.md`, including the 12-character minimum for `ADMIN_PASSWORD` and that the admin account remains disabled when the environment values are missing.
