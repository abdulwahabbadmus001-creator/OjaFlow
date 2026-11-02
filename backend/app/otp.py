import os
import logging
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from .config import get_settings
from .models import OtpChallenge
from .security import hash_password, verify_password

logger = logging.getLogger(__name__)
settings = get_settings()

# SAFE TOGGLE: Read from .env. Defaults to False to prevent breaking local dev.
USE_WHATSAPP_OTP = os.getenv("USE_WHATSAPP_OTP", "false").lower() == "true"
TWILIO_SID = os.getenv("TWILIO_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")


def create_challenge(
    db: Session,
    phone: str,
    purpose: str,
    payload: dict,
    user_id: str | None = None,
    ttl_minutes: int | None = None,
) -> OtpChallenge:
    code = f"{secrets.randbelow(1_000_000):06d}"

    # In production, hash the OTP before saving. For now, storing plain for simplicity,
    # but ensure you hash it in a real prod environment.
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ttl_minutes or settings.otp_ttl_minutes
    )

    challenge = OtpChallenge(
        phone=phone,
        purpose=purpose,
        payload=payload,
        user_id=user_id,
        expires_at_epoch=int(expires_at.timestamp()),
        dev_code_hash=hash_password(code)
        if hasattr(hash_password, "__call__")
        else code,
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    # SAFE DISPATCH: Only attempt WhatsApp if explicitly enabled in .env
    if USE_WHATSAPP_OTP:
        _send_whatsapp_otp(phone, code)
    else:
        # Fallback for local development
        logger.info(f"[DEV OTP] Phone: {phone} | Code: {code} | Purpose: {purpose}")
        print(f"\n\n[DEV OTP] Phone: {phone} | Code: {code} | Purpose: {purpose}\n\n")

    return challenge


def verify_challenge(
    db: Session,
    challenge_id: str,
    code: str,
    purpose: str,
) -> OtpChallenge:
    challenge = db.get(OtpChallenge, challenge_id)
    if not challenge or challenge.purpose != purpose or challenge.verified:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please start again.")

    if challenge.expires_at_epoch <= int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=400, detail="This verification code has expired. Please request a new one.")

    if challenge.attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Please request a new one.")

    if not challenge.dev_code_hash or not verify_password(code, challenge.dev_code_hash):
        challenge.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code. Please try again.")

    challenge.verified = True
    db.commit()
    return challenge


def _send_whatsapp_otp(phone: str, code: str):
    """Sends OTP via Twilio WhatsApp API. Fails silently if env vars are missing."""
    if not all([TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER]):
        logger.warning("WhatsApp OTP enabled but Twilio credentials are missing.")
        return

    try:
        from twilio.rest import Client

        client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)

        message = client.messages.create(
            body=f"Your OjaFlow verification code is: {code}",
            from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
            to=f"whatsapp:{phone}",
        )
        logger.info(f"WhatsApp OTP sent to {phone}. SID: {message.sid}")
    except Exception as e:
        logger.error(f"Failed to send WhatsApp OTP to {phone}: {str(e)}")
        # We do not raise an exception here to prevent breaking the registration flow.
