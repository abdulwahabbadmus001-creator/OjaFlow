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
