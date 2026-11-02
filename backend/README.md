# OjaFlow API

FastAPI backend for OjaFlow. Local development defaults to SQLite and console OTP. Production can use PostgreSQL and Termii without changing application code.

## Local start

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

When `OTP_PROVIDER=console`, a registration/recovery/delete OTP is printed in this backend terminal.

API docs: `http://localhost:8000/docs`
Health: `http://localhost:8000/api/health`

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
