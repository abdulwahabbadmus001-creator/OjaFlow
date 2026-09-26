from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StoreState, User
from ..phone import normalize_nigerian_phone
from ..schemas import LoginRequest, RegistrationStart
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


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def auth_response(
    response: Response,
    user: User
) -> dict:
    token, csrf = create_session_token(
        user.id
    )

    set_session_cookie(
        response,
        token
    )

    return {
        "profile": user_profile(user),
        "business": business_profile(
            user.business
        ),
        "csrfToken": csrf,
    }


@router.post("/register")
def register(
    payload: RegistrationStart,
    response: Response,
    db: Session = Depends(get_db),
):
    phone = normalize_nigerian_phone(
        payload.phone
    )

    existing = db.scalar(
        select(User).where(
            User.phone == phone
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                "An OjaFlow account already exists "
                "for this phone number."
            ),
        )

    user = User(
        phone=phone,
        first_name=payload.firstName.strip(),
        last_name=payload.lastName.strip(),
        other_name=(
            payload.otherName.strip()
            or None
        ),
        preferred_language=(
            payload.preferredLanguage
        ),
        password_hash=hash_password(
            payload.password
        ),
    )

    db.add(user)
    db.flush()

    db.add(
        StoreState(
            user_id=user.id
        )
    )

    db.commit()
    db.refresh(user)

    return auth_response(
        response,
        user
    )


@router.post("/login")
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    phone = normalize_nigerian_phone(
        payload.phone
    )

    user = db.scalar(
        select(User).where(
            User.phone == phone
        )
    )

    if (
        not user
        or not verify_password(
            payload.password,
            user.password_hash
        )
    ):
        raise HTTPException(
            status_code=401,
            detail=(
                "Incorrect phone number "
                "or password."
            ),
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is not active.",
        )

    return auth_response(
        response,
        user
    )


@router.get("/session")
def session(
    auth: AuthContext = Depends(
        current_auth
    ),
):
    return {
        "profile": user_profile(
            auth.user
        ),
        "business": business_profile(
            auth.user.business
        ),
        "csrfToken": auth.csrf,
    }


@router.post("/logout")
def logout(
    response: Response,
    _auth: AuthContext = Depends(
        current_auth_csrf
    ),
):
    clear_session_cookie(response)

    return {
        "ok": True
    }
