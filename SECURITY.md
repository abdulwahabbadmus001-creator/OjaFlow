# OjaFlow Security Notes

OjaFlow uses a server-owned authentication model.

- Passwords are hashed with Argon2 through `pwdlib`; plaintext passwords are never stored.
- Authentication uses an HttpOnly session cookie rather than exposing the session token to application JavaScript.
- Mutating authenticated API requests require a CSRF token.
- OTP creation/verification happens on the FastAPI backend. Production OTP credentials never reach the browser.
- Gemini credentials stay backend-only.
- Each user's store data is retrieved through the authenticated backend session.
- Sensitive settings require password re-authentication.
- Account deletion requires password verification, OTP verification and a short-lived deletion token.
- Local cached records are cleared after explicit logout/account deletion.

## Production requirements

Use HTTPS, a strong random `SESSION_SECRET`, PostgreSQL backups, restricted CORS origins, `COOKIE_SECURE=true`, and the same-origin Netlify `/api` proxy. Keep the session cookie at `SameSite=Lax` in this deployment model.

Never commit `.env`, production database URLs, SMS credentials or Gemini keys to GitHub.
