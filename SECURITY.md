# OjaFlow Security Notes

OjaFlow uses a server-owned authentication and data-synchronization model.

## Current security controls

- Passwords are hashed with the recommended `pwdlib` password-hashing configuration (Argon2-based); plaintext passwords are not stored in application records.
- Authentication uses a signed session token stored in an **HttpOnly cookie**, rather than exposing the session token to application JavaScript.
- State-changing authenticated API requests require a matching **CSRF token** through `X-CSRF-Token`.
- Gemini credentials, database credentials and the session secret stay in backend environment variables.
- Each user's backend store data is loaded through the authenticated session.
- Sensitive account actions such as password changes require the current password.
- Permanent account deletion requires an authenticated session, the current password and the exact confirmation phrase `DELETE MY ACCOUNT`.
- Account deletion removes related application records and the frontend clears that user's local cache.
- `.env`, local database files, virtual environments, `node_modules`, `dist` and other local/sensitive artifacts are excluded from Git.

## Current authentication limitation

The MVP currently registers and authenticates users with **phone number + password**. It does **not** currently verify possession of the phone number through SMS OTP or MFA. The phone number is therefore an account identifier, not a verified possession factor.

Automatic password recovery is intentionally limited until OjaFlow has a verified recovery channel. Stronger low-cost options such as passkeys or a verified WhatsApp/email workflow are roadmap items.

## Local browser data

OjaFlow keeps per-user profile, business and store data in browser `localStorage` to support local-first operation. This browser cache is **not separately encrypted by OjaFlow at rest**. Anyone with sufficient access to the browser profile/device may be able to inspect browser storage.

The authentication session cookie is separate from this cache and is HttpOnly.

## OjaChat data flow

Online OjaChat requests are sent to the FastAPI backend. The backend sends the user message plus relevant business/context information required for the response to the configured Google Gemini API.

The Gemini API key is never exposed to the frontend.

## Production requirements

Before public production use:

- Use HTTPS everywhere.
- Generate a strong random `SESSION_SECRET`.
- Set `COOKIE_SECURE=true`.
- Restrict `FRONTEND_ORIGINS` to the real deployed frontend origin.
- Keep the same-origin Netlify `/api` proxy or an equivalent secure deployment pattern.
- Store production records in PostgreSQL with tested backup/restore procedures.
- Add rate limiting and abuse protection.
- Add structured audit/security logging without unnecessarily logging sensitive business data.
- Introduce database migrations (for example Alembic) before frequent production schema changes.
- Establish a formal incident-response and data-retention process.
- Add a verified account recovery / stronger possession-authentication method before broad scale.

## Secret handling

Never commit any of the following to GitHub:

- `.env`
- production database URLs/passwords
- `SESSION_SECRET`
- Gemini API keys
- provider credentials
- private production logs or database exports

If a secret is accidentally committed, treat it as compromised, rotate it immediately, and remove it from repository history as appropriate.

## Security reporting

A dedicated security/privacy contact channel should be added before public launch. Until then, security issues should be handled privately with the project owner rather than disclosed with exploitable details in public issues.
