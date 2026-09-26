import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from pwdlib import PasswordHash
from sqlalchemy.orm import Session
from .config import get_settings
from .database import get_db
from .models import User

settings = get_settings()
password_hasher = PasswordHash.recommended()
COOKIE_NAME = "ojaflow_session"


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password, password_hash)
    except Exception:
        return False


def create_session_token(user_id: str) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    csrf = secrets.token_urlsafe(24)
    payload = {
        "sub": user_id,
        "csrf": csrf,
        "typ": "session",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.session_days)).timestamp()),
    }
    token = jwt.encode(payload, settings.session_secret, algorithm="HS256")
    return token, csrf


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def decode_session(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=["HS256"])
        if payload.get("typ") != "session":
            raise ValueError("wrong token type")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session has expired. Please log in again.") from exc


@dataclass
class AuthContext:
    user: User
    csrf: str


def current_auth(request: Request, db: Session = Depends(get_db)) -> AuthContext:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Please log in again.")
    payload = decode_session(token)
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return AuthContext(user=user, csrf=str(payload.get("csrf", "")))


def current_auth_csrf(request: Request, auth: AuthContext = Depends(current_auth)) -> AuthContext:
    supplied = request.headers.get("X-CSRF-Token", "")
    if not supplied or not secrets.compare_digest(supplied, auth.csrf):
        raise HTTPException(status_code=403, detail="Security token mismatch. Refresh OjaFlow and try again.")
    return auth


def create_deletion_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "typ": "delete", "iat": int(now.timestamp()), "exp": int((now + timedelta(minutes=10)).timestamp())},
        settings.session_secret,
        algorithm="HS256",
    )


def verify_deletion_token(token: str, user_id: str) -> None:
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=["HS256"])
        if payload.get("typ") != "delete" or payload.get("sub") != user_id:
            raise ValueError("invalid deletion token")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Deletion verification expired. Start again.") from exc
