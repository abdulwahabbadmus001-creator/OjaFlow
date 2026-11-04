from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .migrations import ensure_ojatag_schema
from .routers import (
    account,
    auth,
    chat,
    store,
    support,
)


settings = get_settings()

# First create any completely new tables.
Base.metadata.create_all(bind=engine)

# Then safely upgrade/backfill the existing users table.
ensure_ojatag_schema(engine)


app = FastAPI(
    title=settings.app_name,
    version="1.2.0",
)

# Disallow wildcard origins when credentials are enabled
allowed_origins = [
    origin for origin in settings.origins if origin and origin != "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Content-Type",
        "X-CSRF-Token",
    ],
)


@app.middleware("http")
async def security_headers_middleware(
    request: Request, call_next
) -> Response:
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'"
    )
    if settings.cookie_secure or settings.app_env.lower() == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = (
            "no-store, no-cache, must-revalidate, private"
        )
        response.headers["Pragma"] = "no-cache"
    return response


app.include_router(
    auth.router,
    prefix="/api",
)

app.include_router(
    account.router,
    prefix="/api",
)

app.include_router(
    store.router,
    prefix="/api",
)

app.include_router(
    chat.router,
    prefix="/api",
)

app.include_router(
    support.router,
    prefix="/api",
)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "OjaFlow API",
        "environment": settings.app_env,
    }
