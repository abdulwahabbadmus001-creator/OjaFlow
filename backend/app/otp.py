import hashlib
import secrets
import time
from uuid import uuid4
import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session
from .config import get_settings
from .models import OtpChallenge
from .phone import normalize_nigerian_phone, termii_phone

settings = get_settings()


def _hash_dev_code(code: str) -> str:
    return hashlib.sha256(f"{settings.session_secret}:{code}".encode()).hexdigest()


def create_challenge(db: Session, *, phone: str, purpose: str, payload: dict, user_id: str | None = None) -> OtpChallenge:
    normalized = normalize_nigerian_phone(phone)
    challenge = OtpChallenge(
        id=str(uuid4()),
        user_id=user_id,
        phone=normalized,
        purpose=purpose,
        payload=payload,
        expires_at_epoch=int(time.time()) + settings.otp_ttl_minutes * 60,
    )

    if settings.otp_provider.lower() == "termii":
        if not settings.termii_base_url or not settings.termii_api_key:
            raise HTTPException(status_code=500, detail="Termii OTP is selected but the Termii configuration is incomplete.")
        url = f"{settings.termii_base_url.rstrip('/')}/api/sms/otp/send"
        body = {
            "api_key": settings.termii_api_key,
            "message_type": "NUMERIC",
            "pin_type": "NUMERIC",
            "to": termii_phone(normalized),
            "from": settings.termii_sender_id,
            "channel": settings.termii_channel,
            "pin_attempts": 5,
            "pin_time_to_live": settings.otp_ttl_minutes,
            "pin_length": 6,
            "pin_placeholder": "< 123456 >",
            "message_text": "Your OjaFlow verification code is < 123456 >. Do not share this code.",
        }
        try:
            response = httpx.post(url, json=body, timeout=20)
            data = response.json()
        except Exception as exc:
            raise HTTPException(status_code=502, detail="We could not reach the SMS provider. Please try again.") from exc
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail=data.get("message") or "The SMS provider rejected the OTP request.")
        challenge.provider_ref = data.get("pin_id") or data.get("pinId")
        if not challenge.provider_ref:
            raise HTTPException(status_code=502, detail="The SMS provider did not return a verification reference.")
    else:
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge.dev_code_hash = _hash_dev_code(code)
        print(f"\n[OjaFlow DEV OTP] {normalized} -> {code} (purpose={purpose})\n", flush=True)

    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


def verify_challenge(db: Session, challenge_id: str, code: str, purpose: str) -> OtpChallenge:
    challenge = db.get(OtpChallenge, challenge_id)
    if not challenge or challenge.purpose != purpose:
        raise HTTPException(status_code=400, detail="Verification request not found. Start again.")
    if challenge.verified:
        raise HTTPException(status_code=400, detail="This verification code has already been used.")
    if int(time.time()) > challenge.expires_at_epoch:
        raise HTTPException(status_code=400, detail="The verification code has expired. Request a new one.")
    challenge.attempts += 1
    if challenge.attempts > 5:
        db.commit()
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Request a new verification code.")

    valid = False
    if settings.otp_provider.lower() == "termii":
        if not challenge.provider_ref:
            raise HTTPException(status_code=400, detail="Verification reference is missing.")
        url = f"{settings.termii_base_url.rstrip('/')}/api/sms/otp/verify"
        try:
            response = httpx.post(url, json={
                "api_key": settings.termii_api_key,
                "pin_id": challenge.provider_ref,
                "pin": code,
            }, timeout=20)
            data = response.json()
            valid = response.status_code < 400 and str(data.get("verified", "")).lower() == "true"
        except Exception:
            valid = False
    else:
        valid = bool(challenge.dev_code_hash) and secrets.compare_digest(challenge.dev_code_hash, _hash_dev_code(code))

    if not valid:
        db.commit()
        raise HTTPException(status_code=400, detail="The verification code is incorrect or expired.")

    challenge.verified = True
    db.commit()
    db.refresh(challenge)
    return challenge
