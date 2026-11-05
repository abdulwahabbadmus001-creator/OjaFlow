import hashlib
import hmac
import html
import re
import secrets
import threading
import time
import unicodedata
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import AdminUser, User

settings = get_settings()
legacy_password_hasher = PasswordHash.recommended()

COOKIE_NAME = "ojaflow_session"
ADMIN_COOKIE_NAME = "ojaflow_admin_session"
BCRYPT_SALT_ROUNDS = 12

# Precomputed 12-round Bcrypt hash for constant-time verification when a user does not exist
# (prevents timing-based user enumeration during login and PIN recovery).
DUMMY_BCRYPT_HASH = bcrypt.hashpw(
    b"0000", bcrypt.gensalt(rounds=BCRYPT_SALT_ROUNDS)
).decode("utf-8")

LOCALIZED_TRADER_SECURITY_QUESTIONS: dict[str, list[str]] = {
    "en": [
        "What is the primary market name or location where you trade?",
        "What is the main item or product you sell most?",
        "What is your business nickname or popular shop alias?",
        "What is the first name of your first regular customer or supplier?",
        "What town or street did you open your first shop or stall in?",
    ],
    "pcm": [
        "Wetin be the main market name or area wey you dey trade?",
        "Wetin be my best item to sell?",
        "Wetin be your popular shop alias or business nickname?",
        "Wetin be the first name of your number one customer or supplier?",
        "Which town or street you first open your shop or table?",
    ],
    "yo": [
        "Kí ni orúkọ ọjà mi?",
        "Kí ni ohun tí mo fẹ́ràn láti tà jùlọ?",
        "Kí ni orúkọ ìnagijẹ iṣẹ́ tàbí ṣọ́ọ̀bù mi?",
        "Kí ni orúkọ oníbàárà tàbí aláàánú mi àkọ́kọ́?",
        "Ìlú tàbí òpópónà wo ni mo ti kọ́kọ́ ṣí ṣọ́ọ̀bù mi?",
    ],
    "ha": [
        "Mene ne sunan babbar kasuwar da kake/kike ciniki?",
        "Mene ne babban kayan da kake/kike fi sayarwa?",
        "Mene ne lakabin kasuwancinka ko sunan shagonka?",
        "Mene ne sunan abokin cinikinka ko mai kawo kaya na farko?",
        "A wane gari ko titi ka/kika fara buɗe shago ko tebur?",
    ],
    "ig": [
        "Kedu aha ahịa ebe ị na-azụ ahịa?",
        "Kedu ngwaahịa kacha ere n'ụlọ ahịa gị?",
        "Kedu aha otutu azụmahịa ma ọ bụ ọdụ ahịa gị?",
        "Kedu aha onye ahịa ma ọ bụ onye na-ebubata ngwaahịa mbụ gị?",
        "Kedu obodo ma ọ bụ okporo ụzọ ị meghere ụlọ ahịa mbụ gị?",
    ],
}

TRADER_SECURITY_QUESTIONS: list[str] = LOCALIZED_TRADER_SECURITY_QUESTIONS["en"]

# Brute-force lockout thresholds for 4-digit PINs and Security Answers
MAX_PIN_ATTEMPTS = 5
MAX_RECOVERY_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60  # 15 minutes
RATE_WINDOW_SECONDS = 15 * 60
RECOVERY_TOKEN_TTL_SECONDS = 5 * 60  # 5 minutes

_rate_lock = threading.Lock()
_rate_buckets: dict[str, deque[float]] = {}
_revoked_tokens: dict[str, int] = {}

PIN_PATTERN = re.compile(r"^\d{4}$")
CONTROL_CHARS_RE = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\ufeff]"
)
SCRIPT_TAG_RE = re.compile(r"<\s*/?\s*script\b[^>]*>", re.IGNORECASE)
EVENT_HANDLER_RE = re.compile(r"\bon[a-z]+\s*=", re.IGNORECASE)
DANGEROUS_URI_RE = re.compile(
    r"(?:javascript|vbscript|data\s*:\s*text/html)\s*:", re.IGNORECASE
)
WHITESPACE_RE = re.compile(r"\s+")
APOSTROPHE_VARIANTS_RE = re.compile(r"[\u2018\u2019\u02bc\u0060\u00b4]")
FORBIDDEN_KEYS = {"__proto__", "constructor", "prototype"}


def timing_safe_equal(left: str | bytes, right: str | bytes) -> bool:
    """Constant-time comparison wrapper around hmac.compare_digest to prevent timing side-channels."""
    left_bytes = (
        left.encode("utf-8") if isinstance(left, str) else bytes(left or b"")
    )
    right_bytes = (
        right.encode("utf-8")
        if isinstance(right, str)
        else bytes(right or b"")
    )
    return hmac.compare_digest(left_bytes, right_bytes)


def validate_pin_format(pin: str) -> str:
    cleaned = (pin or "").strip()
    if not PIN_PATTERN.fullmatch(cleaned):
        raise ValueError("PIN must be exactly 4 digits (0-9).")
    return cleaned


def normalize_security_answer(answer: str) -> str:
    """
    Normalize a security answer across local Nigerian languages/dialects (Yorùbá, Igbo,
    Hausa, Pidgin, English) using canonical NFC Unicode composition, unified apostrophes,
    collapsed whitespace, and full Unicode case-folding (.casefold()).
    """
    cleaned = sanitize_text(answer or "", 160)
    nfc = unicodedata.normalize("NFC", cleaned)
    unified_quotes = APOSTROPHE_VARIANTS_RE.sub("'", nfc)
    normalized = WHITESPACE_RE.sub(" ", unified_quotes).strip().casefold()
    if len(normalized) < 2:
        raise ValueError("Security answer must be at least 2 characters.")
    return normalized


def _prepare_bcrypt_secret(normalized_text: str) -> bytes:
    """
    Convert a normalized Unicode answer to UTF-8 bytes for Bcrypt.
    If multi-byte Unicode characters exceed Bcrypt's 72-byte limit, pre-hash with
    SHA-256 hex (64 ASCII bytes) so long native-language answers are never truncated.
    """
    raw = normalized_text.encode("utf-8")
    if len(raw) > 72:
        return hashlib.sha256(raw).hexdigest().encode("utf-8")
    return raw


def hash_password(pin: str) -> str:
    """Hash the 4-digit PIN using Bcrypt with 12 salt rounds."""
    raw = (pin or "").strip().encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_SALT_ROUNDS)
    return bcrypt.hashpw(raw, salt).decode("utf-8")


def verify_password(pin: str, password_hash: str) -> bool:
    """Verify a PIN against a Bcrypt (12 rounds) or legacy Argon2 hash in constant time."""
    if not password_hash:
        return False
    raw = (pin or "").strip().encode("utf-8")
    try:
        if password_hash.startswith(("$2b$", "$2a$", "$2y$")):
            return bcrypt.checkpw(raw, password_hash.encode("utf-8"))
        return legacy_password_hasher.verify(pin, password_hash)
    except Exception:
        return False


def hash_security_answer(answer: str) -> str:
    """Normalize and hash the trader's security answer using Bcrypt (12 salt rounds)."""
    normalized = normalize_security_answer(answer)
    secret_bytes = _prepare_bcrypt_secret(normalized)
    salt = bcrypt.gensalt(rounds=BCRYPT_SALT_ROUNDS)
    return bcrypt.hashpw(secret_bytes, salt).decode("utf-8")


def verify_security_answer(answer: str, answer_hash: str | None) -> bool:
    """Compare a submitted security answer against its stored Bcrypt hash in constant time."""
    if not answer_hash:
        return False
    try:
        normalized = normalize_security_answer(answer)
        secret_bytes = _prepare_bcrypt_secret(normalized)
        return bcrypt.checkpw(
            secret_bytes,
            answer_hash.encode("utf-8"),
        )
    except Exception:
        return False


def verify_dummy_pin(pin: str) -> None:
    """Run a dummy Bcrypt check so non-existent user lookups take the same time as real ones."""
    verify_password(pin, DUMMY_BCRYPT_HASH)


def verify_dummy_security_answer(answer: str) -> None:
    """Run a dummy Bcrypt check when verifying a security answer for a non-existent user."""
    try:
        raw = unicodedata.normalize("NFC", (answer or "dummy")).strip().casefold()
        bcrypt.checkpw(
            _prepare_bcrypt_secret(raw),
            DUMMY_BCRYPT_HASH.encode("utf-8"),
        )
    except Exception:
        pass


def deterministic_fallback_question(
    identifier: str, language: str = "en"
) -> str:
    """
    Deterministically pick a realistic localized trader security question for unknown
    identifiers using HMAC-SHA256 so attackers cannot enumerate registered accounts.
    """
    questions = LOCALIZED_TRADER_SECURITY_QUESTIONS.get(
        language, TRADER_SECURITY_QUESTIONS
    )
    digest = hmac.new(
        _jwt_key(),
        identifier.strip().upper().encode("utf-8"),
        hashlib.sha256,
    ).digest()
    index = digest[0] % len(questions)
    return questions[index]


def sanitize_text(value: str, max_length: int = 5000) -> str:
    """
    Sanitize user-supplied text to strip dangerous script payloads and control characters
    while preserving canonical NFC Unicode characters and tonal marks across local languages.
    """
    if not isinstance(value, str):
        value = str(value or "")
    normalized = unicodedata.normalize("NFC", value)
    cleaned = CONTROL_CHARS_RE.sub("", normalized)
    cleaned = SCRIPT_TAG_RE.sub("", cleaned)
    cleaned = EVENT_HANDLER_RE.sub("", cleaned)
    cleaned = DANGEROUS_URI_RE.sub("", cleaned)
    cleaned = cleaned.replace("<", "‹").replace(">", "›")
    return cleaned.strip()[:max_length]


def sanitize_json(value: Any, depth: int = 0) -> Any:
    """Recursively sanitize JSON store/chat structures against XSS and prototype/operator injection."""
    if depth > 8:
        return None
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for k, v in list(value.items())[:200]:
            key_str = str(k).strip()
            if (
                not key_str
                or key_str in FORBIDDEN_KEYS
                or key_str.startswith("$")
            ):
                continue
            result[sanitize_text(key_str, 120)] = sanitize_json(v, depth + 1)
        return result
    if isinstance(value, list):
        return [sanitize_json(item, depth + 1) for item in value[:5000]]
    if isinstance(value, str):
        return sanitize_text(value, 2000)
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return html.escape(str(value))[:500]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if forwarded:
        return forwarded[:64]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def check_rate_limit(
    key: str,
    *,
    max_attempts: int = MAX_PIN_ATTEMPTS,
    window_seconds: int = RATE_WINDOW_SECONDS,
) -> None:
    now = time.time()
    cutoff = now - window_seconds
    with _rate_lock:
        bucket = _rate_buckets.get(key)
        if bucket is not None:
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= max_attempts:
                retry_after = max(1, int(bucket[0] + window_seconds - now))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait 15 minutes before trying again.",
                    headers={"Retry-After": str(retry_after)},
                )


def record_rate_limit_hit(
    key: str,
    *,
    window_seconds: int = RATE_WINDOW_SECONDS,
) -> None:
    now = time.time()
    cutoff = now - window_seconds
    with _rate_lock:
        bucket = _rate_buckets.setdefault(key, deque())
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        bucket.append(now)


def clear_rate_limit(key: str) -> None:
    with _rate_lock:
        _rate_buckets.pop(key, None)


def check_user_lockout(user: User, db: Session) -> None:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    if user.locked_until_epoch and user.locked_until_epoch > now_epoch:
        retry_after = user.locked_until_epoch - now_epoch
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked due to multiple incorrect PIN attempts. Please try again in 15 minutes.",
            headers={"Retry-After": str(retry_after)},
        )
    if user.locked_until_epoch and user.locked_until_epoch <= now_epoch:
        user.locked_until_epoch = None
        user.failed_pin_attempts = 0
        db.commit()


def record_user_pin_failure(user: User, db: Session) -> None:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    user.failed_pin_attempts = (user.failed_pin_attempts or 0) + 1
    if user.failed_pin_attempts >= MAX_PIN_ATTEMPTS:
        user.locked_until_epoch = now_epoch + LOCKOUT_SECONDS
    db.commit()


def clear_user_pin_failures(user: User, db: Session) -> None:
    if user.failed_pin_attempts or user.locked_until_epoch:
        user.failed_pin_attempts = 0
        user.locked_until_epoch = None
        db.commit()


def check_recovery_lockout(user: User, db: Session) -> None:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    if (
        user.recovery_locked_until_epoch
        and user.recovery_locked_until_epoch > now_epoch
    ):
        retry_after = user.recovery_locked_until_epoch - now_epoch
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="PIN recovery is temporarily locked due to multiple incorrect answers. Please try again in 15 minutes.",
            headers={"Retry-After": str(retry_after)},
        )
    if (
        user.recovery_locked_until_epoch
        and user.recovery_locked_until_epoch <= now_epoch
    ):
        user.recovery_locked_until_epoch = None
        user.failed_recovery_attempts = 0
        db.commit()


def record_recovery_failure(user: User, db: Session) -> None:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    user.failed_recovery_attempts = (user.failed_recovery_attempts or 0) + 1
    if user.failed_recovery_attempts >= MAX_RECOVERY_ATTEMPTS:
        user.recovery_locked_until_epoch = now_epoch + LOCKOUT_SECONDS
    db.commit()


def clear_recovery_failures(user: User, db: Session) -> None:
    if user.failed_recovery_attempts or user.recovery_locked_until_epoch:
        user.failed_recovery_attempts = 0
        user.recovery_locked_until_epoch = None
        db.commit()


def _jwt_key() -> bytes:
    """Derive a 256-bit (32-byte) key for HS256 JWT signing (RFC 7518 Section 3.2)."""
    raw = settings.session_secret.encode("utf-8")
    return raw if len(raw) >= 32 else hashlib.sha256(raw).digest()


def _pin_version_fingerprint(user: User) -> str:
    return (user.password_hash or "")[-12:]


def create_session_token(user: User) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    csrf = secrets.token_urlsafe(24)
    jti = secrets.token_urlsafe(16)
    payload = {
        "sub": user.id,
        "csrf": csrf,
        "jti": jti,
        "ver": _pin_version_fingerprint(user),
        "iss": "ojaflow-api",
        "typ": "session",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.session_days)).timestamp()),
    }
    token = jwt.encode(payload, _jwt_key(), algorithm="HS256")
    return token, csrf


def create_recovery_token(user: User) -> str:
    """Create a single-use, short-lived (5-minute) token after verifying the security answer."""
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(16)
    payload = {
        "sub": user.id,
        "jti": jti,
        "ver": _pin_version_fingerprint(user),
        "iss": "ojaflow-api",
        "typ": "pin_recovery",
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + RECOVERY_TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, _jwt_key(), algorithm="HS256")


def verify_recovery_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _jwt_key(), algorithms=["HS256"])
        if payload.get("typ") != "pin_recovery":
            raise ValueError("wrong token type")
        if _is_token_revoked(payload.get("jti")):
            raise ValueError("recovery token already used")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your PIN recovery session has expired. Please answer your security question again.",
        ) from exc


def revoke_session_token(token: str | None) -> None:
    if not token:
        return
    try:
        payload = jwt.decode(token, _jwt_key(), algorithms=["HS256"])
        jti = payload.get("jti")
        exp = int(payload.get("exp", 0))
        if jti and exp:
            now_epoch = int(time.time())
            with _rate_lock:
                expired = [k for k, v in _revoked_tokens.items() if v <= now_epoch]
                for k in expired:
                    _revoked_tokens.pop(k, None)
                _revoked_tokens[str(jti)] = exp
    except Exception:
        pass


def _is_token_revoked(jti: str | None) -> bool:
    if not jti:
        return False
    now_epoch = int(time.time())
    with _rate_lock:
        exp = _revoked_tokens.get(jti)
        if exp is None:
            return False
        if exp <= now_epoch:
            _revoked_tokens.pop(jti, None)
            return False
        return True


def set_session_cookie(response: Response, token: str) -> None:
    is_secure = settings.cookie_secure or settings.app_env.lower() == "production"
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=is_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    is_secure = settings.cookie_secure or settings.app_env.lower() == "production"
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_secure,
        samesite=settings.cookie_samesite,
    )


def decode_session(token: str) -> dict:
    try:
        payload = jwt.decode(token, _jwt_key(), algorithms=["HS256"])
        if payload.get("typ") != "session":
            raise ValueError("wrong token type")
        if _is_token_revoked(payload.get("jti")):
            raise ValueError("session token revoked")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please log in again.",
        ) from exc


@dataclass
class AuthContext:
    user: User
    csrf: str
    token: str = ""


def current_auth(request: Request, db: Session = Depends(get_db)) -> AuthContext:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Please log in again.")
    payload = decode_session(token)
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Please log in again.")
    token_ver = str(payload.get("ver") or "")
    if token_ver and not timing_safe_equal(
        token_ver, _pin_version_fingerprint(user)
    ):
        raise HTTPException(
            status_code=401,
            detail="Your PIN was recently changed. Please log in again.",
        )
    return AuthContext(user=user, csrf=str(payload.get("csrf", "")), token=token)


def current_auth_csrf(
    request: Request, auth: AuthContext = Depends(current_auth)
) -> AuthContext:
    supplied = request.headers.get("X-CSRF-Token", "")
    if not supplied or not timing_safe_equal(supplied, auth.csrf):
        raise HTTPException(
            status_code=403,
            detail="Security token mismatch. Refresh OjaFlow and try again.",
        )
    return auth


def check_admin_lockout(admin: AdminUser, db: Session) -> None:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    if admin.locked_until_epoch and admin.locked_until_epoch > now_epoch:
        retry_after = admin.locked_until_epoch - now_epoch
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Admin account temporarily locked due to failed login attempts. Try again in 15 minutes.",
            headers={"Retry-After": str(retry_after)},
        )
    if admin.locked_until_epoch and admin.locked_until_epoch <= now_epoch:
        admin.locked_until_epoch = None
        admin.failed_login_attempts = 0
        db.commit()


def record_admin_login_failure(admin: AdminUser, db: Session) -> None:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    admin.failed_login_attempts = (admin.failed_login_attempts or 0) + 1
    if admin.failed_login_attempts >= MAX_PIN_ATTEMPTS:
        admin.locked_until_epoch = now_epoch + LOCKOUT_SECONDS
    db.commit()


def clear_admin_login_failures(admin: AdminUser, db: Session) -> None:
    if admin.failed_login_attempts or admin.locked_until_epoch:
        admin.failed_login_attempts = 0
        admin.locked_until_epoch = None
        db.commit()


def create_admin_session_token(admin: AdminUser) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    csrf = secrets.token_urlsafe(24)
    jti = secrets.token_urlsafe(16)
    payload = {
        "sub": admin.id,
        "email": admin.email,
        "role": "admin",
        "csrf": csrf,
        "jti": jti,
        "ver": (admin.password_hash or "")[-12:],
        "iss": "ojaflow-admin-api",
        "typ": "admin_session",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=12)).timestamp()),
    }
    token = jwt.encode(payload, _jwt_key(), algorithm="HS256")
    return token, csrf


def set_admin_session_cookie(response: Response, token: str) -> None:
    is_secure = settings.cookie_secure or settings.app_env.lower() == "production"
    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=token,
        max_age=12 * 3600,
        httponly=True,
        secure=is_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def clear_admin_session_cookie(response: Response) -> None:
    is_secure = settings.cookie_secure or settings.app_env.lower() == "production"
    response.delete_cookie(
        ADMIN_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_secure,
        samesite=settings.cookie_samesite,
    )


def decode_admin_session(token: str) -> dict:
    try:
        payload = jwt.decode(token, _jwt_key(), algorithms=["HS256"])
        if payload.get("typ") != "admin_session":
            raise ValueError("wrong token type")
        if payload.get("iss") != "ojaflow-admin-api":
            raise ValueError("wrong token issuer")
        if payload.get("role") != "admin":
            raise ValueError("insufficient role")
        configured_admin_email = settings.admin_email.strip().lower()
        token_email = str(payload.get("email") or "").strip().lower()
        if not configured_admin_email or not timing_safe_equal(
            token_email, configured_admin_email
        ):
            raise ValueError("admin email mismatch")
        if _is_token_revoked(payload.get("jti")):
            raise ValueError("admin session token revoked")
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session expired or unauthorized. Please sign in to the Admin Console.",
        ) from exc


@dataclass
class AdminAuthContext:
    admin: AdminUser
    csrf: str
    token: str = ""


def current_admin(
    request: Request, db: Session = Depends(get_db)
) -> AdminAuthContext:
    token = request.cookies.get(ADMIN_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required.",
        )
    payload = decode_admin_session(token)
    admin = db.get(AdminUser, payload.get("sub"))
    configured_admin_email = settings.admin_email.strip().lower()
    if (
        not admin
        or not admin.is_active
        or admin.role != "admin"
        or not configured_admin_email
        or not timing_safe_equal(
            admin.email.strip().lower(), configured_admin_email
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: valid administrator privileges required.",
        )
    token_ver = str(payload.get("ver") or "")
    if token_ver and not timing_safe_equal(
        token_ver, (admin.password_hash or "")[-12:]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin credentials changed. Please sign in again.",
        )
    return AdminAuthContext(
        admin=admin, csrf=str(payload.get("csrf", "")), token=token
    )


def current_admin_csrf(
    request: Request, auth: AdminAuthContext = Depends(current_admin)
) -> AdminAuthContext:
    supplied = (
        request.headers.get("X-Admin-CSRF-Token")
        or request.headers.get("X-CSRF-Token")
        or ""
    )
    if not supplied or not timing_safe_equal(supplied, auth.csrf):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin CSRF security token mismatch. Refresh and try again.",
        )
    return auth
