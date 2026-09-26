from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business, OtpChallenge, StoreState, SupportTicket, User
from ..schemas import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    SaveProfileRequest,
    VerifyPasswordRequest,
)
from ..security import (
    AuthContext,
    clear_session_cookie,
    current_auth_csrf,
    hash_password,
    verify_password,
)
from ..serializers import business_profile, user_profile


router = APIRouter(
    prefix="/account",
    tags=["Account"]
)


@router.post("/verify-password")
def verify_password_route(
    payload: VerifyPasswordRequest,
    auth: AuthContext = Depends(
        current_auth_csrf
    ),
):
    if not verify_password(
        payload.password,
        auth.user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password.",
        )

    return {
        "ok": True
    }


@router.put("/profile")
def save_profile(
    payload: SaveProfileRequest,
    auth: AuthContext = Depends(
        current_auth_csrf
    ),
    db: Session = Depends(get_db),
):
    user = auth.user
    profile = payload.profile

    user.first_name = (
        profile.firstName.strip()
    )
    user.last_name = (
        profile.lastName.strip()
    )
    user.other_name = (
        (profile.otherName or "").strip()
        or None
    )
    user.preferred_language = (
        profile.preferredLanguage
    )
    user.onboarding_completed = (
        profile.onboardingCompleted
    )
    user.business_profile_completed = (
        profile.businessProfileCompleted
    )

    if payload.business:
        b = payload.business
        business = user.business

        if business is None:
            business = Business(
                user_id=user.id
            )
            db.add(business)

        business.business_name = (
            b.businessName.strip()
        )
        business.category = (
            b.category.strip()
        )
        business.phone = (
            b.phone.strip()
        )
        business.address = (
            b.address.strip()
        )
        business.currency = b.currency

        user.business_profile_completed = True
        user.onboarding_completed = True

    db.commit()
    db.refresh(user)

    return {
        "profile": user_profile(user),
        "business": business_profile(
            user.business
        ),
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    auth: AuthContext = Depends(
        current_auth_csrf
    ),
    db: Session = Depends(get_db),
):
    if not verify_password(
        payload.currentPassword,
        auth.user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail=(
                "Current password is incorrect."
            ),
        )

    auth.user.password_hash = (
        hash_password(
            payload.newPassword
        )
    )

    db.commit()

    return {
        "ok": True
    }


@router.post("/delete")
def delete_account(
    payload: DeleteAccountRequest,
    response: Response,
    auth: AuthContext = Depends(
        current_auth_csrf
    ),
    db: Session = Depends(get_db),
):
    if not verify_password(
        payload.password,
        auth.user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password.",
        )

    if (
        payload.confirmation.strip().upper()
        != "DELETE MY ACCOUNT"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Type DELETE MY ACCOUNT exactly "
                "to confirm permanent deletion."
            ),
        )

    user_id = auth.user.id

    db.execute(
        delete(SupportTicket).where(
            SupportTicket.user_id == user_id
        )
    )

    db.execute(
        delete(OtpChallenge).where(
            OtpChallenge.user_id == user_id
        )
    )

    db.execute(
        delete(StoreState).where(
            StoreState.user_id == user_id
        )
    )

    db.execute(
        delete(Business).where(
            Business.user_id == user_id
        )
    )

    db.execute(
        delete(User).where(
            User.id == user_id
        )
    )

    db.commit()

    clear_session_cookie(response)

    return {
        "ok": True
    }
