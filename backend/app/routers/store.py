from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StoreState
from ..schemas import StorePayload
from ..security import AuthContext, current_auth, current_auth_csrf
from ..serializers import merge_store_data, normalize_store_data

router = APIRouter(prefix="/store", tags=["Store Sync"])


@router.get("")
def get_store(
    auth: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    state = db.get(StoreState, auth.user.id)
    if not state:
        state = StoreState(
            user_id=auth.user.id,
            data=normalize_store_data(None),
            version=0,
        )
        db.add(state)
        db.commit()
        db.refresh(state)

    normalized = normalize_store_data(state.data)
    return {
        "data": normalized,
        "version": state.version or 0,
        "updatedAt": (
            state.updated_at.isoformat() if state.updated_at else None
        ),
    }


@router.put("")
def save_store(
    payload: StorePayload,
    auth: AuthContext = Depends(current_auth_csrf),
    db: Session = Depends(get_db),
):
    state = db.get(StoreState, auth.user.id)
    if not state:
        state = StoreState(user_id=auth.user.id, version=0)
        db.add(state)

    current_version = state.version or 0
    client_version = payload.version or 0

    if current_version > client_version and state.data:
        # Another device synced newer changes; merge collections by ID to prevent data loss
        state.data = merge_store_data(state.data, payload.data)
    else:
        state.data = normalize_store_data(payload.data)

    state.version = max(current_version, client_version) + 1
    db.commit()
    db.refresh(state)

    return {
        "data": state.data,
        "version": state.version,
        "updatedAt": (
            state.updated_at.isoformat() if state.updated_at else None
        ),
    }
