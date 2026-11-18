from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .database import Base, engine
from .migrations import ensure_ojatag_schema, ensure_proof_schema
from .modules.proof.router import router as proof_router
from .modules.proof.service import ProofError
from .routers import (
    account,
    admin,
    auth,
    chat,
    store,
    support,
)


settings = get_settings()

# First create any completely new tables.
Base.metadata.create_all(bind=engine)

# Then safely upgrade/backfill the existing users table and proof indexes.
ensure_ojatag_schema(engine)
ensure_proof_schema(engine)


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
        "Authorization",
        "X-Admin-Authorization",
        "X-CSRF-Token",
        "X-Admin-CSRF-Token",
    ],
)


@app.exception_handler(ProofError)
async def proof_error_handler(
    _request: Request,
    exc: ProofError,
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    if request.url.path.startswith("/api/proof"):
        errors = exc.errors()
        first_msg = (
            errors[0].get("msg", "Validation error.")
            if errors
            else "Validation error."
        )
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": str(first_msg),
                }
            },
        )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    if request.url.path.startswith("/api/proof"):
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            413: "PAYLOAD_TOO_LARGE",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMIT_EXCEEDED",
        }
        error_code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": error_code,
                    "message": str(exc.detail),
                }
            },
            headers=getattr(exc, "headers", None),
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
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
        "camera=(), microphone=(self), geolocation=()"
    )
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'"
    )
    if settings.cookie_secure or settings.app_env.lower() == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    if request.url.path.startswith("/api/proof/verify/"):
        response.headers["Cache-Control"] = "no-store"
    elif request.url.path.startswith("/api/"):
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

app.include_router(
    admin.router,
    prefix="/api",
)

app.include_router(
    proof_router,
    prefix="/api",
)


@app.get("/")
@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": "OjaFlow API",
        "environment": settings.app_env,
        "health": "/api/health",
    }
