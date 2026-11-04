from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..identity import (
    generate_ojatag,
    looks_like_ojatag,
    normalize_ojatag,
)
from ..models import StoreState, User
from ..otp import create_challenge, verify_challenge
from ..phone import normalize_nigerian_phone
from ..schemas import (
    ForgotStart,
    ForgotVerify,
    LoginRequest,
    RecoveryQuestionRequest,
    RecoveryResetPinRequest,
    RecoveryVerifyAnswerRequest,
    RegistrationStart,
)
from ..security import (
    LOCALIZED_TRADER_SECURITY_QUESTIONS,
    TRADER_SECURITY_QUESTIONS,
    AuthContext,
    check_rate_limit,
    check_recovery_lockout,
    check_user_lockout,
    clear_rate_limit,
    clear_recovery_failures,
    clear_session_cookie,
    clear_user_pin_failures,
    client_ip,
    create_recovery_token,
    create_session_token,
    current_auth,
    current_auth_csrf,
    deterministic_fallback_question,
    hash_password,
    hash_security_answer,
    record_rate_limit_hit,
    record_recovery_failure,
    record_user_pin_failure,
    revoke_session_token,
    set_session_cookie,
    timing_safe_equal,
    verify_dummy_pin,
    verify_dummy_security_answer,
    verify_password,
    verify_recovery_token,
    verify_security_answer,
)
from ..serializers import business_profile, store_snapshot, user_profile


settings = get_settings()

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

GENERIC_AUTH_ERROR = "Invalid phone number, OjaTag, or 4-digit PIN."
GENERIC_RECOVERY_ERROR = (
    "Incorrect security answer or account details. Please check and try again."
)


def auth_response(response: Response, user: User) -> dict:
    token, csrf = create_session_token(user)
    set_session_cookie(response, token)

    return {
        "profile": user_profile(user),
        "business": business_profile(user.business),
        "store": store_snapshot(user.store),
        "csrfToken": csrf,
    }


def create_unique_ojatag(db: Session) -> str:
    for _ in range(30):
        tag = generate_ojatag()
        exists = db.scalar(select(User.id).where(User.oja_tag == tag))

        if not exists:
            return tag

    raise HTTPException(
        status_code=503,
        detail="OjaFlow could not create your account ID right now. Please try again.",
    )


def find_user_for_login(
    identifier: str,
    db: Session,
) -> User | None:
    value = identifier.strip()

    if not value:
        raise HTTPException(
            status_code=422,
            detail="Enter your phone number or OjaTag.",
        )

    if looks_like_ojatag(value):
        try:
            tag = normalize_ojatag(value)
        except ValueError:
            return None

        return db.scalar(select(User).where(User.oja_tag == tag))

    try:
        phone = normalize_nigerian_phone(value)
    except HTTPException:
        return None

    return db.scalar(select(User).where(User.phone == phone))


def create_user(
    db: Session,
    *,
    phone: str,
    first_name: str,
    last_name: str,
    other_name: str | None,
    preferred_language: str,
    password_hash: str,
    security_question: str,
    security_answer_hash: str,
) -> User:
    user = User(
        phone=phone,
        oja_tag=create_unique_ojatag(db),
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        other_name=(other_name or "").strip() or None,
        preferred_language=preferred_language,
        password_hash=password_hash,
        security_question=security_question.strip(),
        security_answer_hash=security_answer_hash,
    )

    db.add(user)
    db.flush()

    db.add(StoreState(user_id=user.id))
    db.commit()
    db.refresh(user)

    return user


@router.post("/register")
@router.post("/register/request-otp")
def register(
    payload: RegistrationStart,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Create an account immediately with a Bcrypt-hashed 4-digit PIN and security answer."""
    ip = client_ip(request)
    check_rate_limit(f"reg:ip:{ip}", max_attempts=10)

    phone = normalize_nigerian_phone(payload.phone)
    check_rate_limit(f"reg:phone:{phone}", max_attempts=5)

    # Always compute the 12-round Bcrypt hashes upfront so response timing is uniform
    # regardless of whether the phone number is already registered.
    pin_hash = hash_password(payload.pin_value)
    answer_hash = hash_security_answer(payload.securityAnswer)

    existing = db.scalar(select(User.id).where(User.phone == phone))

    if existing:
        record_rate_limit_hit(f"reg:ip:{ip}")
        record_rate_limit_hit(f"reg:phone:{phone}")
        raise HTTPException(
            status_code=409,
            detail="Unable to complete registration with these details. If you already have an account, please log in.",
        )

    try:
        user = create_user(
            db,
            phone=phone,
            first_name=payload.firstName,
            last_name=payload.lastName,
            other_name=payload.otherName,
            preferred_language=payload.preferredLanguage,
            password_hash=pin_hash,
            security_question=payload.securityQuestion,
            security_answer_hash=answer_hash,
        )
    except IntegrityError as exc:
        db.rollback()
        record_rate_limit_hit(f"reg:ip:{ip}")
        raise HTTPException(
            status_code=409,
            detail="Unable to complete registration with these details. Please try again.",
        ) from exc

    return auth_response(response, user)


@router.get("/recovery/questions")
def list_recovery_questions(lang: str = "en"):
    """Return the localized trader-focused security questions."""
    questions = LOCALIZED_TRADER_SECURITY_QUESTIONS.get(
        lang, TRADER_SECURITY_QUESTIONS
    )
    return {
        "questions": questions,
        "byLanguage": LOCALIZED_TRADER_SECURITY_QUESTIONS,
    }


@router.post("/recovery/question")
def get_recovery_question(
    payload: RecoveryQuestionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Look up a user's personalized security question by phone number or OjaTag.
    Returns the exact question in the language/dialect the user originally set it in,
    along with their saved preferredLanguage.
    To prevent user enumeration, unknown identifiers receive a deterministic
    HMAC-selected trader question in the requested language.
    """
    ip = client_ip(request)
    identifier_raw = payload.lookup_identifier
    if not identifier_raw:
        raise HTTPException(
            status_code=422,
            detail="Enter your phone number or OjaTag.",
        )

    identifier_key = identifier_raw.upper()
    check_rate_limit(f"recovery_q:ip:{ip}", max_attempts=10)
    check_rate_limit(f"recovery_q:id:{identifier_key}", max_attempts=5)
    record_rate_limit_hit(f"recovery_q:ip:{ip}")
    record_rate_limit_hit(f"recovery_q:id:{identifier_key}")

    user = find_user_for_login(identifier_raw, db)
    if user and user.security_question:
        return {
            "securityQuestion": user.security_question,
            "preferredLanguage": (
                user.preferred_language or payload.preferredLanguage
            ),
        }

    return {
        "securityQuestion": deterministic_fallback_question(
            identifier_raw, payload.preferredLanguage
        ),
        "preferredLanguage": payload.preferredLanguage,
    }


@router.post("/recovery/verify-answer")
def verify_recovery_answer(
    payload: RecoveryVerifyAnswerRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Verify the user's security answer in constant time against their stored Bcrypt hash.
    Returns a short-lived single-use recoveryToken to authorize setting a new 4-digit PIN.
    """
    ip = client_ip(request)
    identifier_raw = payload.lookup_identifier
    if not identifier_raw:
        raise HTTPException(
            status_code=422,
            detail="Enter your phone number or OjaTag.",
        )

    identifier_key = identifier_raw.upper()
    check_rate_limit(f"recovery_v:ip:{ip}", max_attempts=10)
    check_rate_limit(f"recovery_v:id:{identifier_key}", max_attempts=5)

    user = find_user_for_login(identifier_raw, db)

    if not user or not user.security_answer_hash:
        verify_dummy_security_answer(payload.securityAnswer)
        record_rate_limit_hit(f"recovery_v:ip:{ip}")
        record_rate_limit_hit(f"recovery_v:id:{identifier_key}")
        raise HTTPException(
            status_code=401,
            detail=GENERIC_RECOVERY_ERROR,
        )

    check_rate_limit(f"recovery_v:user:{user.id}", max_attempts=5)
    check_recovery_lockout(user, db)

    if (
        not verify_security_answer(
            payload.securityAnswer, user.security_answer_hash
        )
        or not user.is_active
    ):
        record_rate_limit_hit(f"recovery_v:ip:{ip}")
        record_rate_limit_hit(f"recovery_v:id:{identifier_key}")
        record_rate_limit_hit(f"recovery_v:user:{user.id}")
        record_recovery_failure(user, db)
        raise HTTPException(
            status_code=401,
            detail=GENERIC_RECOVERY_ERROR,
        )

    return {
        "ok": True,
        "recoveryToken": create_recovery_token(user),
    }


@router.post("/recovery/reset-pin")
def reset_pin_with_recovery(
    payload: RecoveryResetPinRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Set a new strict 4-digit PIN after security question verification,
    rotating session tokens and logging the trader into their synced store.
    """
    ip = client_ip(request)
    check_rate_limit(f"recovery_r:ip:{ip}", max_attempts=10)

    user: User | None = None

    if payload.recoveryToken:
        token_data = verify_recovery_token(payload.recoveryToken)
        user = db.get(User, token_data.get("sub"))
        token_ver = str(token_data.get("ver") or "")
        if (
            not user
            or not user.is_active
            or not timing_safe_equal(
                token_ver, (user.password_hash or "")[-12:]
            )
        ):
            record_rate_limit_hit(f"recovery_r:ip:{ip}")
            raise HTTPException(
                status_code=400,
                detail="Your PIN recovery session has expired. Please answer your security question again.",
            )
        check_recovery_lockout(user, db)
        revoke_session_token(payload.recoveryToken)
    else:
        identifier_raw = payload.lookup_identifier
        identifier_key = identifier_raw.upper()
        check_rate_limit(f"recovery_v:id:{identifier_key}", max_attempts=5)
        user = find_user_for_login(identifier_raw, db)
        if not user or not user.security_answer_hash:
            verify_dummy_security_answer(payload.securityAnswer or "")
            record_rate_limit_hit(f"recovery_r:ip:{ip}")
            record_rate_limit_hit(f"recovery_v:id:{identifier_key}")
            raise HTTPException(
                status_code=401,
                detail=GENERIC_RECOVERY_ERROR,
            )
        check_rate_limit(f"recovery_v:user:{user.id}", max_attempts=5)
        check_recovery_lockout(user, db)
        if (
            not verify_security_answer(
                payload.securityAnswer or "", user.security_answer_hash
            )
            or not user.is_active
        ):
            record_rate_limit_hit(f"recovery_r:ip:{ip}")
            record_rate_limit_hit(f"recovery_v:id:{identifier_key}")
            record_rate_limit_hit(f"recovery_v:user:{user.id}")
            record_recovery_failure(user, db)
            raise HTTPException(
                status_code=401,
                detail=GENERIC_RECOVERY_ERROR,
            )

    user.password_hash = hash_password(payload.pin_value)
    clear_user_pin_failures(user, db)
    clear_recovery_failures(user, db)
    clear_rate_limit(f"recovery_v:user:{user.id}")
    clear_rate_limit(f"login:user:{user.id}")

    if user.store is None:
        store = db.get(StoreState, user.id)
        if not store:
            store = StoreState(user_id=user.id)
            db.add(store)

    db.commit()
    db.refresh(user)

    return auth_response(response, user)


@router.post("/forgot/request-otp")
def forgot_request_otp(
    payload: ForgotStart,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    check_rate_limit(f"forgot:ip:{ip}", max_attempts=5)
    record_rate_limit_hit(f"forgot:ip:{ip}")

    phone = normalize_nigerian_phone(payload.phone)
    check_rate_limit(f"forgot:phone:{phone}", max_attempts=3)
    record_rate_limit_hit(f"forgot:phone:{phone}")

    user = db.scalar(select(User).where(User.phone == phone))

    if not user:
        verify_dummy_pin("0000")
        raise HTTPException(
            status_code=400,
            detail="If an account matches this phone number, a reset challenge has been initiated.",
        )

    challenge = create_challenge(
        db,
        phone=phone,
        purpose="forgot_password",
        payload={},
        user_id=user.id,
    )

    return {
        "challengeId": challenge.id,
        "expiresInSeconds": settings.otp_ttl_minutes * 60,
        "message": "PIN reset verification code requested successfully.",
    }


@router.post("/forgot/verify")
def forgot_verify_otp(
    payload: ForgotVerify,
    request: Request,
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    check_rate_limit(f"forgot_verify:ip:{ip}", max_attempts=5)

    challenge = verify_challenge(
        db,
        payload.challengeId,
        payload.code,
        "forgot_password",
    )

    if not challenge.user_id:
        raise HTTPException(
            status_code=400,
            detail="This PIN reset request is invalid. Please start again.",
        )

    user = db.get(User, challenge.user_id)

    if not user or user.phone != challenge.phone:
        raise HTTPException(
            status_code=400,
            detail="The account could not be verified. Please start again.",
        )

    user.password_hash = hash_password(payload.newPin or payload.newPassword or "")
    clear_user_pin_failures(user, db)
    db.commit()

    return {
        "ok": True,
        "message": "Your 4-digit PIN has been updated successfully.",
    }


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    identifier_raw = payload.login_identifier
    identifier_key = identifier_raw.upper()

    # Check IP and per-identifier brute-force rate limits before processing
    check_rate_limit(f"login:ip:{ip}", max_attempts=15)
    check_rate_limit(f"login:id:{identifier_key}", max_attempts=5)

    user = find_user_for_login(identifier_raw, db)

    if not user:
        # Constant-time dummy Bcrypt check prevents user enumeration via timing
        verify_dummy_pin(payload.pin_value)
        record_rate_limit_hit(f"login:ip:{ip}")
        record_rate_limit_hit(f"login:id:{identifier_key}")
        raise HTTPException(
            status_code=401,
            detail=GENERIC_AUTH_ERROR,
        )

    # Also enforce rate limit by canonical user phone so alternating phone & OjaTag
    # cannot bypass per-account rate limiting.
    check_rate_limit(f"login:user:{user.id}", max_attempts=5)
    check_user_lockout(user, db)

    if not verify_password(payload.pin_value, user.password_hash) or not user.is_active:
        record_rate_limit_hit(f"login:ip:{ip}")
        record_rate_limit_hit(f"login:id:{identifier_key}")
        record_rate_limit_hit(f"login:user:{user.id}")
        record_user_pin_failure(user, db)
        raise HTTPException(
            status_code=401,
            detail=GENERIC_AUTH_ERROR,
        )

    # Successful authentication: reset failure counters
    clear_user_pin_failures(user, db)
    clear_rate_limit(f"login:id:{identifier_key}")
    clear_rate_limit(f"login:user:{user.id}")

    # Transparently upgrade any non-Bcrypt hash to 12-round Bcrypt
    if not user.password_hash.startswith(("$2b$", "$2a$", "$2y$")):
        user.password_hash = hash_password(payload.pin_value)
        db.commit()

    # Ensure central StoreState exists for cross-device syncing
    if user.store is None:
        store = db.get(StoreState, user.id)
        if not store:
            store = StoreState(user_id=user.id)
            db.add(store)
            db.commit()
            db.refresh(user)

    return auth_response(response, user)


@router.get("/session")
def session(
    auth: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    if auth.user.store is None:
        store = db.get(StoreState, auth.user.id)
        if not store:
            store = StoreState(user_id=auth.user.id)
            db.add(store)
            db.commit()
            db.refresh(auth.user)

    return {
        "profile": user_profile(auth.user),
        "business": business_profile(auth.user.business),
        "store": store_snapshot(auth.user.store),
        "csrfToken": auth.csrf,
    }


@router.post("/logout")
def logout(
    response: Response,
    auth: AuthContext = Depends(current_auth_csrf),
):
    revoke_session_token(auth.token)
    clear_session_cookie(response)
    return {"ok": True}
