from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SupportTicket
from ..schemas import SupportRequest
from ..security import AuthContext, current_auth_csrf

router = APIRouter(prefix="/support", tags=["Support"])


@router.post("/ticket")
def create_ticket(payload: SupportRequest, auth: AuthContext = Depends(current_auth_csrf), db: Session = Depends(get_db)):
    ticket = SupportTicket(
        user_id=auth.user.id,
        category=payload.category.strip(),
        subject=payload.subject.strip(),
        message=payload.message.strip(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"ok": True, "ticketId": ticket.id, "status": ticket.status}
