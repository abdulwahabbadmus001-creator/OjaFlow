import re
import secrets

OJA_TAG_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

OJA_TAG_RE = re.compile(r"^OJA-([23456789A-HJ-NP-Z]{4})-([23456789A-HJ-NP-Z]{4})$")


def generate_ojatag() -> str:
    left = "".join(secrets.choice(OJA_TAG_ALPHABET) for _ in range(4))

    right = "".join(secrets.choice(OJA_TAG_ALPHABET) for _ in range(4))

    return f"OJA-{left}-{right}"


def normalize_ojatag(value: str) -> str:
    raw = re.sub(r"[\s_-]", "", (value or "").upper())

    if not raw.startswith("OJA"):
        raise ValueError("not an OjaTag")

    payload = raw[3:]

    if len(payload) != 8 or any(
        character not in OJA_TAG_ALPHABET for character in payload
    ):
        raise ValueError("invalid OjaTag")

    tag = f"OJA-{payload[:4]}-{payload[4:]}"

    if not OJA_TAG_RE.fullmatch(tag):
        raise ValueError("invalid OjaTag")

    return tag


def looks_like_ojatag(value: str) -> bool:
    raw = re.sub(r"[\s_-]", "", (value or "").upper())

    return raw.startswith("OJA")
