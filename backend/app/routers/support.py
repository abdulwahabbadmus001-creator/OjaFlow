from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SupportTicket, UserNotification
from ..schemas import SupportRequest
from ..security import (
    AuthContext,
    current_auth,
    current_auth_csrf,
    sanitize_text,
)

router = APIRouter(prefix="/support", tags=["Support"])


def _serialize_user_ticket(ticket: SupportTicket) -> dict:
    return {
        "id": ticket.id,
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


def _serialize_notification(n: UserNotification) -> dict:
    return {
        "id": n.id,
        "ticketId": n.ticket_id,
        "kind": n.kind,
        "title": n.title,
        "message": n.message,
        "isRead": bool(n.is_read),
        "createdAt": n.created_at.isoformat() if n.created_at else None,
    }


@router.post("/ticket")
def create_ticket(
    payload: SupportRequest,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    ticket = SupportTicket(
        user_id=auth.user.id,
        category=payload.category.strip(),
        subject=payload.subject.strip(),
        message=payload.message.strip(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {
        "ok": True,
        "ticketId": ticket.id,
        "status": ticket.status,
        "ticket": _serialize_user_ticket(ticket),
    }


@router.get("/tickets")
def list_my_tickets(
    auth: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    tickets = list(
        db.scalars(
            select(SupportTicket)
            .where(SupportTicket.user_id == auth.user.id)
            .order_by(SupportTicket.created_at.desc())
        ).all()
    )
    return {"tickets": [_serialize_user_ticket(t) for t in tickets]}


@router.get("/notifications")
def list_my_notifications(
    auth: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    notifications = list(
        db.scalars(
            select(UserNotification)
            .where(UserNotification.user_id == auth.user.id)
            .order_by(UserNotification.created_at.desc())
            .limit(30)
        ).all()
    )
    serialized = [_serialize_notification(n) for n in notifications]
    unread_count = sum(1 for n in serialized if not n["isRead"])
    return {
        "unreadCount": unread_count,
        "notifications": serialized,
    }


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    cleaned_id = sanitize_text(notification_id, 64)
    notification = db.scalar(
        select(UserNotification).where(
            UserNotification.id == cleaned_id,
            UserNotification.user_id == auth.user.id,
        )
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notification.is_read = True
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    db.execute(
        update(UserNotification)
        .where(
            UserNotification.user_id == auth.user.id,
            UserNotification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    db.commit()
    return {"ok": True}
