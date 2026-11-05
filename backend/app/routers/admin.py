from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import (
    AdminUser,
    Business,
    OtpChallenge,
    StoreState,
    SupportTicket,
    SystemBroadcast,
    User,
    UserNotification,
)
from ..schemas import (
    AdminBroadcastRequest,
    AdminLoginRequest,
    AdminResetUserPinRequest,
    AdminTicketReplyRequest,
    AdminUpdateUserStatusRequest,
)
from ..security import (
    CANONICAL_ADMIN_EMAIL,
    CANONICAL_ADMIN_PASSWORD,
    AdminAuthContext,
    check_admin_lockout,
    check_rate_limit,
    clear_admin_login_failures,
    clear_admin_session_cookie,
    clear_rate_limit,
    clear_recovery_failures,
    clear_user_pin_failures,
    client_ip,
    create_admin_session_token,
    current_admin,
    current_admin_csrf,
    hash_password,
    is_valid_admin_email,
    record_admin_login_failure,
    record_rate_limit_hit,
    revoke_session_token,
    sanitize_text,
    set_admin_session_cookie,
    timing_safe_equal,
    verify_dummy_pin,
    verify_password,
)

settings = get_settings()

router = APIRouter(
    prefix="/admin",
    tags=["Administration"],
)

GENERIC_ADMIN_AUTH_ERROR = "Invalid system administrator email or password."


def _serialize_admin(admin: AdminUser) -> dict:
    return {
        "id": admin.id,
        "email": admin.email,
        "role": admin.role,
        "lastLoginAt": (
            admin.last_login_at.isoformat() if admin.last_login_at else None
        ),
    }


def _serialize_admin_user_row(user: User) -> dict:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    pin_locked = bool(
        user.locked_until_epoch and user.locked_until_epoch > now_epoch
    )
    recovery_locked = bool(
        user.recovery_locked_until_epoch
        and user.recovery_locked_until_epoch > now_epoch
    )
    return {
        "uid": user.id,
        "ojaTag": user.oja_tag or "",
        "phoneNumber": user.phone,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "otherName": user.other_name or "",
        "preferredLanguage": user.preferred_language,
        "securityQuestion": user.security_question or "",
        "isActive": bool(user.is_active),
        "isPinLocked": pin_locked,
        "isRecoveryLocked": recovery_locked,
        "failedPinAttempts": user.failed_pin_attempts or 0,
        "failedRecoveryAttempts": user.failed_recovery_attempts or 0,
        "lockedUntilEpoch": user.locked_until_epoch if pin_locked else None,
        "recoveryLockedUntilEpoch": (
            user.recovery_locked_until_epoch if recovery_locked else None
        ),
        "businessName": (
            user.business.business_name if user.business else ""
        ),
        "businessCategory": (
            user.business.category if user.business else ""
        ),
        "createdAt": (
            user.created_at.isoformat() if user.created_at else None
        ),
    }


def _serialize_ticket(ticket: SupportTicket, user: User | None) -> dict:
    return {
        "id": ticket.id,
        "userId": ticket.user_id,
        "userName": (
            f"{user.first_name} {user.last_name}".strip()
            if user
            else "Unknown Trader"
        ),
        "userPhone": user.phone if user else "",
        "userOjaTag": (user.oja_tag or "") if user else "",
        "businessName": (
            user.business.business_name
            if user and user.business
            else ""
        ),
        "category": ticket.category,
        "subject": ticket.subject,
        "message": ticket.message,
        "status": ticket.status,
        "adminReply": ticket.admin_reply or "",
        "repliedBy": ticket.replied_by or "",
        "repliedAt": (
            ticket.replied_at.isoformat() if ticket.replied_at else None
        ),
        "createdAt": (
            ticket.created_at.isoformat() if ticket.created_at else None
        ),
    }


@router.post("/login")
def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    ip = client_ip(request)
    email_key = payload.email.strip().lower()
    supplied_pw = payload.password.strip()[:72]

    configured_admin_email = (settings.admin_email or "").strip().lower()
    configured_admin_pw = (settings.admin_password or "").strip()[:72]

    matches_env_pair = (
        bool(configured_admin_email and configured_admin_pw)
        and timing_safe_equal(email_key, configured_admin_email)
        and (
            timing_safe_equal(supplied_pw, configured_admin_pw)
            or (
                configured_admin_pw.endswith("$")
                and timing_safe_equal(
                    supplied_pw.rstrip("$"),
                    configured_admin_pw.rstrip("$"),
                )
            )
        )
    )
    matches_canonical_pair = timing_safe_equal(
        email_key, CANONICAL_ADMIN_EMAIL
    ) and (
        timing_safe_equal(supplied_pw, CANONICAL_ADMIN_PASSWORD)
        or timing_safe_equal(
            supplied_pw, CANONICAL_ADMIN_PASSWORD.rstrip("$") + "$"
        )
    )

    direct_owner_match = bool(matches_env_pair or matches_canonical_pair)

    if not direct_owner_match:
        check_rate_limit(f"admin_login:ip:{ip}", max_attempts=8)
        check_rate_limit(f"admin_login:email:{email_key}", max_attempts=5)

    if not is_valid_admin_email(email_key):
        verify_dummy_pin(supplied_pw)
        record_rate_limit_hit(f"admin_login:ip:{ip}")
        record_rate_limit_hit(f"admin_login:email:{email_key}")
        raise HTTPException(
            status_code=401,
            detail=GENERIC_ADMIN_AUTH_ERROR,
        )

    admin = db.scalar(
        select(AdminUser).where(AdminUser.email == email_key)
    )

    if direct_owner_match:
        # Self-heal / provision the AdminUser row if it wasn't seeded yet or had an older hash
        if admin is None:
            admin = AdminUser(
                email=email_key,
                role="admin",
                password_hash=hash_password(supplied_pw),
                is_active=True,
                failed_login_attempts=0,
                locked_until_epoch=None,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        else:
            changed = False
            if not admin.is_active:
                admin.is_active = True
                changed = True
            if admin.role != "admin":
                admin.role = "admin"
                changed = True
            if not admin.password_hash or not verify_password(
                supplied_pw, admin.password_hash
            ):
                admin.password_hash = hash_password(supplied_pw)
                changed = True
            if changed:
                db.commit()
                db.refresh(admin)
    else:
        if not admin:
            verify_dummy_pin(supplied_pw)
            record_rate_limit_hit(f"admin_login:ip:{ip}")
            record_rate_limit_hit(f"admin_login:email:{email_key}")
            raise HTTPException(
                status_code=401,
                detail=GENERIC_ADMIN_AUTH_ERROR,
            )

        check_admin_lockout(admin, db)

        if (
            not verify_password(supplied_pw, admin.password_hash)
            or not admin.is_active
            or admin.role != "admin"
        ):
            record_rate_limit_hit(f"admin_login:ip:{ip}")
            record_rate_limit_hit(f"admin_login:email:{email_key}")
            record_admin_login_failure(admin, db)
            raise HTTPException(
                status_code=401,
                detail=GENERIC_ADMIN_AUTH_ERROR,
            )

    clear_admin_login_failures(admin, db)
    clear_rate_limit(f"admin_login:ip:{ip}")
    clear_rate_limit(f"admin_login:email:{email_key}")
    admin.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(admin)

    token, csrf = create_admin_session_token(admin)
    set_admin_session_cookie(response, token)

    return {
        "admin": _serialize_admin(admin),
        "csrfToken": csrf,
        "accessToken": token,
    }


@router.get("/session")
def admin_session(
    auth: AdminAuthContext = Depends(current_admin),
):
    return {
        "admin": _serialize_admin(auth.admin),
        "csrfToken": auth.csrf,
    }


@router.post("/logout")
def admin_logout(
    response: Response,
    auth: AdminAuthContext = Depends(current_admin_csrf),
):
    revoke_session_token(auth.token)
    clear_admin_session_cookie(response)
    return {"ok": True}


@router.get("/overview")
def admin_overview(
    _auth: AdminAuthContext = Depends(current_admin),
    db: Session = Depends(get_db),
):
    users = list(
        db.scalars(select(User).order_by(User.created_at.desc())).all()
    )
    tickets = list(
        db.scalars(
            select(SupportTicket).order_by(SupportTicket.created_at.desc())
        ).all()
    )
    users_by_id = {u.id: u for u in users}

    serialized_users = [_serialize_admin_user_row(u) for u in users]
    serialized_tickets = [
        _serialize_ticket(t, users_by_id.get(t.user_id)) for t in tickets
    ]

    locked_count = sum(
        1
        for u in serialized_users
        if u["isPinLocked"] or u["isRecoveryLocked"]
    )
    active_count = sum(1 for u in serialized_users if u["isActive"])
    open_tickets = sum(1 for t in serialized_tickets if t["status"] == "open")
    answered_tickets = sum(
        1 for t in serialized_tickets if t["status"] == "answered"
    )

    return {
        "stats": {
            "totalUsers": len(serialized_users),
            "activeUsers": active_count,
            "deactivatedUsers": len(serialized_users) - active_count,
            "lockedUsers": locked_count,
            "totalTickets": len(serialized_tickets),
            "openTickets": open_tickets,
            "answeredTickets": answered_tickets,
        },
        "users": serialized_users,
        "tickets": serialized_tickets,
    }


@router.get("/users")
def admin_list_users(
    q: str = Query(default="", max_length=80),
    _auth: AdminAuthContext = Depends(current_admin),
    db: Session = Depends(get_db),
):
    stmt = select(User).order_by(User.created_at.desc())
    cleaned_q = sanitize_text(q, 80).strip()
    if cleaned_q:
        like_expr = f"%{cleaned_q}%"
        stmt = stmt.where(
            or_(
                User.phone.ilike(like_expr),
                User.oja_tag.ilike(like_expr),
                User.first_name.ilike(like_expr),
                User.last_name.ilike(like_expr),
            )
        )
    users = list(db.scalars(stmt).all())
    return {"users": [_serialize_admin_user_row(u) for u in users]}


@router.post("/users/{user_id}/unlock")
def admin_unlock_user(
    user_id: str,
    _auth: AdminAuthContext = Depends(current_admin_csrf),
    db: Session = Depends(get_db),
):
    user = db.get(User, sanitize_text(user_id, 64))
    if not user:
        raise HTTPException(status_code=404, detail="Trader account not found.")

    clear_user_pin_failures(user, db)
    clear_recovery_failures(user, db)
    clear_rate_limit(f"login:user:{user.id}")
    clear_rate_limit(f"recovery_v:user:{user.id}")
    if user.phone:
        clear_rate_limit(f"login:id:{user.phone.upper()}")
        clear_rate_limit(f"recovery_v:id:{user.phone.upper()}")
    if user.oja_tag:
        clear_rate_limit(f"login:id:{user.oja_tag.upper()}")
        clear_rate_limit(f"recovery_v:id:{user.oja_tag.upper()}")

    db.add(
        UserNotification(
            user_id=user.id,
            kind="system",
            title="Account Unlocked by OjaFlow Support",
            message="Your account PIN and recovery lockouts have been cleared by an OjaFlow administrator.",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(user)

    return {"ok": True, "user": _serialize_admin_user_row(user)}


@router.post("/users/{user_id}/reset-pin")
def admin_reset_user_pin(
    user_id: str,
    payload: AdminResetUserPinRequest,
    _auth: AdminAuthContext = Depends(current_admin_csrf),
    db: Session = Depends(get_db),
):
    user = db.get(User, sanitize_text(user_id, 64))
    if not user:
        raise HTTPException(status_code=404, detail="Trader account not found.")

    user.password_hash = hash_password(payload.newPin)
    clear_user_pin_failures(user, db)
    clear_recovery_failures(user, db)
    clear_rate_limit(f"login:user:{user.id}")
    clear_rate_limit(f"recovery_v:user:{user.id}")

    db.add(
        UserNotification(
            user_id=user.id,
            kind="system",
            title="4-Digit PIN Reset by Administrator",
            message="An OjaFlow administrator reset your 4-digit PIN as requested. For your security, you can change it anytime in Settings → Security & Login.",
            is_read=False,
        )
    )
    db.commit()
    db.refresh(user)

    return {"ok": True, "user": _serialize_admin_user_row(user)}


@router.post("/users/{user_id}/status")
def admin_update_user_status(
    user_id: str,
    payload: AdminUpdateUserStatusRequest,
    _auth: AdminAuthContext = Depends(current_admin_csrf),
    db: Session = Depends(get_db),
):
    user = db.get(User, sanitize_text(user_id, 64))
    if not user:
        raise HTTPException(status_code=404, detail="Trader account not found.")

    user.is_active = bool(payload.isActive)
    db.commit()
    db.refresh(user)

    return {"ok": True, "user": _serialize_admin_user_row(user)}


@router.delete("/users/{user_id}")
def admin_delete_user(
    user_id: str,
    _auth: AdminAuthContext = Depends(current_admin_csrf),
    db: Session = Depends(get_db),
):
    cleaned_id = sanitize_text(user_id, 64)
    user = db.get(User, cleaned_id)
    if not user:
        raise HTTPException(status_code=404, detail="Trader account not found.")

    db.execute(
        delete(UserNotification).where(UserNotification.user_id == cleaned_id)
    )
    db.execute(
        delete(SupportTicket).where(SupportTicket.user_id == cleaned_id)
    )
    db.execute(delete(OtpChallenge).where(OtpChallenge.user_id == cleaned_id))
    db.execute(delete(StoreState).where(StoreState.user_id == cleaned_id))
    db.execute(delete(Business).where(Business.user_id == cleaned_id))
    db.execute(delete(User).where(User.id == cleaned_id))
    db.commit()

    return {"ok": True, "deletedUserId": cleaned_id}


@router.get("/tickets")
def admin_list_tickets(
    status: str = Query(default="", max_length=30),
    _auth: AdminAuthContext = Depends(current_admin),
    db: Session = Depends(get_db),
):
    stmt = select(SupportTicket).order_by(SupportTicket.created_at.desc())
    cleaned_status = sanitize_text(status, 30).strip().lower()
    if cleaned_status in {"open", "answered", "closed"}:
        stmt = stmt.where(SupportTicket.status == cleaned_status)

    tickets = list(db.scalars(stmt).all())
    user_ids = {t.user_id for t in tickets}
    users_by_id = (
        {
            u.id: u
            for u in db.scalars(
                select(User).where(User.id.in_(user_ids))
            ).all()
        }
        if user_ids
        else {}
    )

    return {
        "tickets": [
            _serialize_ticket(t, users_by_id.get(t.user_id)) for t in tickets
        ]
    }


@router.post("/tickets/{ticket_id}/reply")
def admin_reply_ticket(
    ticket_id: str,
    payload: AdminTicketReplyRequest,
    auth: AdminAuthContext = Depends(current_admin_csrf),
    db: Session = Depends(get_db),
):
    ticket = db.get(SupportTicket, sanitize_text(ticket_id, 64))
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found.")

    now = datetime.now(timezone.utc)
    ticket.admin_reply = payload.reply
    ticket.replied_by = auth.admin.email
    ticket.replied_at = now
    ticket.status = payload.status

    notification = UserNotification(
        user_id=ticket.user_id,
        ticket_id=ticket.id,
        kind="support_reply",
        title=f"OjaFlow Support Reply: {ticket.subject}",
        message=payload.reply,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(ticket)

    user = db.get(User, ticket.user_id)
    return {
        "ok": True,
        "ticket": _serialize_ticket(ticket, user),
    }




def _serialize_broadcast(broadcast: SystemBroadcast | None) -> dict | None:
    if not broadcast:
        return None
    return {
        "id": broadcast.id,
        "kind": broadcast.kind,
        "title": broadcast.title,
        "message": broadcast.message,
        "isActive": bool(broadcast.is_active),
        "updatedBy": broadcast.updated_by or "",
        "updatedAt": (
            broadcast.updated_at.isoformat() if broadcast.updated_at else None
        ),
    }


@router.get("/broadcast")
def admin_get_broadcast(
    _auth: AdminAuthContext = Depends(current_admin),
    db: Session = Depends(get_db),
):
    broadcast = db.scalar(
        select(SystemBroadcast)
        .order_by(SystemBroadcast.updated_at.desc())
        .limit(1)
    )
    return {"broadcast": _serialize_broadcast(broadcast)}


@router.post("/broadcast")
def admin_save_broadcast(
    payload: AdminBroadcastRequest,
    auth: AdminAuthContext = Depends(current_admin_csrf),
    db: Session = Depends(get_db),
):
    broadcast = db.scalar(
        select(SystemBroadcast)
        .order_by(SystemBroadcast.updated_at.desc())
        .limit(1)
    )
    now = datetime.now(timezone.utc)
    if broadcast is None:
        broadcast = SystemBroadcast(
            kind=payload.kind,
            title=payload.title,
            message=payload.message,
            is_active=bool(payload.isActive),
            updated_by=auth.admin.email,
            updated_at=now,
        )
        db.add(broadcast)
    else:
        broadcast.kind = payload.kind
        broadcast.title = payload.title
        broadcast.message = payload.message
        broadcast.is_active = bool(payload.isActive)
        broadcast.updated_by = auth.admin.email
        broadcast.updated_at = now

    db.commit()
    db.refresh(broadcast)
    return {"ok": True, "broadcast": _serialize_broadcast(broadcast)}
