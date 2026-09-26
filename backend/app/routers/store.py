from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import StoreState
from ..schemas import StorePayload
from ..security import AuthContext, current_auth, current_auth_csrf

router = APIRouter(prefix="/store", tags=["Store Sync"])

EMPTY_STORE = {"products": [], "sales": [], "expenses": [], "debts": [], "customers": [], "invoices": []}


@router.get("")
def get_store(auth: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    state = db.get(StoreState, auth.user.id)
    if not state:
        state = StoreState(user_id=auth.user.id, data=EMPTY_STORE.copy(), version=0)
        db.add(state)
        db.commit()
        db.refresh(state)
    return {"data": state.data or EMPTY_STORE, "version": state.version, "updatedAt": state.updated_at.isoformat() if state.updated_at else None}


@router.put("")
def save_store(payload: StorePayload, auth: AuthContext = Depends(current_auth_csrf), db: Session = Depends(get_db)):
    state = db.get(StoreState, auth.user.id)
    if not state:
        state = StoreState(user_id=auth.user.id)
        db.add(state)
    state.data = payload.data
    state.version = max(state.version or 0, payload.version or 0) + 1
    db.commit()
    db.refresh(state)
    return {"data": state.data, "version": state.version, "updatedAt": state.updated_at.isoformat() if state.updated_at else None}
