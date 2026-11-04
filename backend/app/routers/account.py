from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Business, OtpChallenge, StoreState, SupportTicket, User
from ..schemas import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    SaveProfileRequest,
    UpdateSecurityQuestionRequest,
    VerifyPasswordRequest,
)
from ..security import (
    AuthContext,
    check_rate_limit,
    check_user_lockout,
    clear_recovery_failures,
    clear_session_cookie,
    clear_user_pin_failures,
    client_ip,
    create_session_token,
    current_auth_csrf,
    hash_password,
    hash_security_answer,
    record_rate_limit_hit,
    record_user_pin_failure,
    revoke_session_token,
    set_session_cookie,
    timing_safe_equal,
    verify_password,
)
from ..serializers import business_profile, user_profile


router = APIRouter(
    prefix="/account",
    tags=["Account"],
)


@router.post("/verify-password")
def verify_password_route(
    payload: VerifyPasswordRequest,
    request: Request,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    rate_key = f"reauth:{auth.user.id}:{ip}"
    check_rate_limit(rate_key, max_attempts=5)
    check_user_lockout(auth.user, db)

    if not verify_password(payload.pin_value, auth.user.password_hash):
        record_rate_limit_hit(rate_key)
        record_user_pin_failure(auth.user, db)
        raise HTTPException(
            status_code=401,
            detail="Incorrect 4-digit PIN.",
        )

    clear_user_pin_failures(auth.user, db)
    return {"ok": True}


@router.put("/profile")
def save_profile(
    payload: SaveProfileRequest,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    user = auth.user
    profile = payload.profile

    user.first_name = profile.firstName.strip()
    user.last_name = profile.lastName.strip()
    user.other_name = (profile.otherName or "").strip() or None
    user.preferred_language = profile.preferredLanguage
    user.onboarding_completed = profile.onboardingCompleted
    user.business_profile_completed = profile.businessProfileCompleted

    if payload.business:
        b = payload.business
        business = user.business

        if business is None:
            business = Business(user_id=user.id)
            db.add(business)

        business.business_name = b.businessName.strip()
        business.category = b.category.strip()
        business.phone = b.phone.strip()
        business.address = b.address.strip()
        business.currency = b.currency

        user.business_profile_completed = True
        user.onboarding_completed = True

    db.commit()
    db.refresh(user)

    return {
        "profile": user_profile(user),
        "business": business_profile(user.business),
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    rate_key = f"changepin:{auth.user.id}:{ip}"
    check_rate_limit(rate_key, max_attempts=5)
    check_user_lockout(auth.user, db)

    current_pin = payload.currentPin or payload.currentPassword or ""
    new_pin = payload.newPin or payload.newPassword or ""

    if not verify_password(current_pin, auth.user.password_hash):
        record_rate_limit_hit(rate_key)
        record_user_pin_failure(auth.user, db)
        raise HTTPException(
            status_code=401,
            detail="Current 4-digit PIN is incorrect.",
        )

    auth.user.password_hash = hash_password(new_pin)
    clear_user_pin_failures(auth.user, db)
    db.commit()
    db.refresh(auth.user)

    # Revoke the old token and issue a fresh session token bound to the new PIN hash
    revoke_session_token(auth.token)
    token, csrf = create_session_token(auth.user)
    set_session_cookie(response, token)

    return {
        "ok": True,
        "csrfToken": csrf,
    }


@router.post("/security-question")
def update_security_question(
    payload: UpdateSecurityQuestionRequest,
    request: Request,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    rate_key = f"secquestion:{auth.user.id}:{ip}"
    check_rate_limit(rate_key, max_attempts=5)
    check_user_lockout(auth.user, db)

    if not verify_password(payload.pin_value, auth.user.password_hash):
        record_rate_limit_hit(rate_key)
        record_user_pin_failure(auth.user, db)
        raise HTTPException(
            status_code=401,
            detail="Current 4-digit PIN is incorrect.",
        )

    auth.user.security_question = payload.securityQuestion.strip()
    auth.user.security_answer_hash = hash_security_answer(
        payload.securityAnswer
    )
    if payload.preferredLanguage:
        auth.user.preferred_language = payload.preferredLanguage
    clear_user_pin_failures(auth.user, db)
    clear_recovery_failures(auth.user, db)
    db.commit()
    db.refresh(auth.user)

    return {
        "ok": True,
        "profile": user_profile(auth.user),
    }


@router.post("/delete")
def delete_account(
    payload: DeleteAccountRequest,
    request: Request,
    response: Response,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    rate_key = f"delete:{auth.user.id}:{ip}"
    check_rate_limit(rate_key, max_attempts=5)
    check_user_lockout(auth.user, db)

    pin_val = payload.pin or payload.password or ""
    if not verify_password(pin_val, auth.user.password_hash):
        record_rate_limit_hit(rate_key)
        record_user_pin_failure(auth.user, db)
        raise HTTPException(
            status_code=401,
            detail="Incorrect 4-digit PIN.",
        )

    if not timing_safe_equal(
        payload.confirmation.strip().upper(), "DELETE MY ACCOUNT"
    ):
        raise HTTPException(
            status_code=400,
            detail="Type DELETE MY ACCOUNT exactly to confirm permanent deletion.",
        )

    user_id = auth.user.id

    db.execute(delete(SupportTicket).where(SupportTicket.user_id == user_id))
    db.execute(delete(OtpChallenge).where(OtpChallenge.user_id == user_id))
    db.execute(delete(StoreState).where(StoreState.user_id == user_id))
    db.execute(delete(Business).where(Business.user_id == user_id))
    db.execute(delete(User).where(User.id == user_id))

    db.commit()

    revoke_session_token(auth.token)
    clear_session_cookie(response)

    return {"ok": True}
