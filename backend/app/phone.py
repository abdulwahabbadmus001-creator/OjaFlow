import re
from fastapi import HTTPException


def normalize_nigerian_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("234"):
        local = digits[3:]
    elif digits.startswith("0"):
        local = digits[1:]
    else:
        local = digits
    if len(local) != 10 or not local.startswith(("7", "8", "9")):
        raise HTTPException(status_code=422, detail="Enter a valid Nigerian phone number.")
    return f"+234{local}"


def termii_phone(value: str) -> str:
    return normalize_nigerian_phone(value).replace("+", "")
