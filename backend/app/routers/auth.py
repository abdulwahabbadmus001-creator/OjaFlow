from fastapi import APIRouter, Depends, HTTPException, Response
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
from ..models import OtpChallenge, StoreState, User
from ..otp import create_challenge, verify_challenge
from ..phone import normalize_nigerian_phone
from ..schemas import (
    ForgotStart,
    ForgotVerify,
    LoginRequest,
    OtpVerify,
    RegistrationStart,
)
from ..security import (
    AuthContext,
    clear_session_cookie,
    create_session_token,
    current_auth,
    current_auth_csrf,
    hash_password,
    set_session_cookie,
    verify_password,
)
from ..serializers import business_profile, user_profile


settings = get_settings()

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


def auth_response(response: Response, user: User) -> dict:
    token, csrf = create_session_token(user.id)
    set_session_cookie(response, token)

    return {
        "profile": user_profile(user),
        "business": business_profile(user.business),
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

    phone = normalize_nigerian_phone(value)

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
) -> User:
    user = User(
        phone=phone,
        oja_tag=create_unique_ojatag(db),
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        other_name=(other_name or "").strip() or None,
        preferred_language=preferred_language,
        password_hash=password_hash,
    )

    db.add(user)
    db.flush()

    db.add(StoreState(user_id=user.id))
    db.commit()
    db.refresh(user)

    return user


@router.post("/register/request-otp")
def register_request_otp(
    payload: RegistrationStart,
    db: Session = Depends(get_db),
):
    phone = normalize_nigerian_phone(payload.phone)

    existing = db.scalar(select(User.id).where(User.phone == phone))

    if existing:
        raise HTTPException(
            status_code=409,
            detail="An OjaFlow account already exists for this phone number.",
        )

    # Never store the plaintext registration password in the OTP record.
    registration_data = payload.model_dump()
    registration_data["phone"] = phone
    registration_data["passwordHash"] = hash_password(registration_data.pop("password"))

    challenge = create_challenge(
        db,
        phone=phone,
        purpose="register",
        payload=registration_data,
    )

    return {
        "challengeId": challenge.id,
        "expiresInSeconds": settings.otp_ttl_minutes * 60,
        "message": "Verification code requested successfully.",
    }


@router.post("/register/verify")
def register_verify_otp(
    payload: OtpVerify,
    response: Response,
    db: Session = Depends(get_db),
):
    challenge = verify_challenge(
        db,
        payload.challengeId,
        payload.code,
        "register",
    )

    registration_data = challenge.payload or {}

    required_fields = (
        "firstName",
        "lastName",
        "preferredLanguage",
        "passwordHash",
    )

    if any(not registration_data.get(field) for field in required_fields):
        raise HTTPException(
            status_code=400,
            detail="Registration details are incomplete. Please start again.",
        )

    existing = db.scalar(select(User.id).where(User.phone == challenge.phone))

    if existing:
        raise HTTPException(
            status_code=409,
            detail="An OjaFlow account already exists for this phone number.",
        )

    try:
        user = create_user(
            db,
            phone=challenge.phone,
            first_name=registration_data["firstName"],
            last_name=registration_data["lastName"],
            other_name=registration_data.get("otherName"),
            preferred_language=registration_data["preferredLanguage"],
            password_hash=registration_data["passwordHash"],
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The account could not be created because the phone number or OjaTag is already in use. Please try again.",
        ) from exc

    return auth_response(response, user)


@router.post("/register")
def register(
    payload: RegistrationStart,
    response: Response,
    db: Session = Depends(get_db),
):
    """Keep direct registration available for older frontend versions."""
    phone = normalize_nigerian_phone(payload.phone)

    existing = db.scalar(select(User.id).where(User.phone == phone))

    if existing:
        raise HTTPException(
            status_code=409,
            detail="An OjaFlow account already exists for this phone number.",
        )

    try:
        user = create_user(
            db,
            phone=phone,
            first_name=payload.firstName,
            last_name=payload.lastName,
            other_name=payload.otherName,
            preferred_language=payload.preferredLanguage,
            password_hash=hash_password(payload.password),
        )
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The account could not be created. Please try again.",
        ) from exc

    return auth_response(response, user)


@router.post("/forgot/request-otp")
def forgot_request_otp(
    payload: ForgotStart,
    db: Session = Depends(get_db),
):
    phone = normalize_nigerian_phone(payload.phone)

    user = db.scalar(select(User).where(User.phone == phone))

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No OjaFlow account was found for this phone number.",
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
        "message": "Password reset verification code requested successfully.",
    }


@router.post("/forgot/verify")
def forgot_verify_otp(
    payload: ForgotVerify,
    db: Session = Depends(get_db),
):
    challenge = verify_challenge(
        db,
        payload.challengeId,
        payload.code,
        "forgot_password",
    )

    if not challenge.user_id:
        raise HTTPException(
            status_code=400,
            detail="This password reset request is invalid. Please start again.",
        )

    user = db.get(User, challenge.user_id)

    if not user or user.phone != challenge.phone:
        raise HTTPException(
            status_code=400,
            detail="The account could not be verified. Please start again.",
        )

    user.password_hash = hash_password(payload.newPassword)
    db.commit()

    return {
        "ok": True,
        "message": "Your password has been updated successfully.",
    }


@router.post("/login")
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = find_user_for_login(
        payload.login_identifier,
        db,
    )

    if not user or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect phone number, OjaTag or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is not active.",
        )

    return auth_response(response, user)


@router.get("/session")
def session(
    auth: AuthContext = Depends(current_auth),
):
    return {
        "profile": user_profile(auth.user),
        "business": business_profile(auth.user.business),
        "csrfToken": auth.csrf,
    }


@router.post("/logout")
def logout(
    response: Response,
    _auth: AuthContext = Depends(current_auth_csrf),
):
    clear_session_cookie(response)
    return {"ok": True}
