from collections import deque
import threading
import time

from fastapi import Depends, Request

from ...models import User
from ...security import AuthContext, client_ip, current_auth
from .service import ProofError

VERIFY_MAX_REQUESTS_PER_MINUTE = 60
VERIFY_WINDOW_SECONDS = 60
MAX_PROOF_BODY_BYTES = 1024 * 1024  # 1 MB

_verify_lock = threading.Lock()
_verify_buckets: dict[str, deque[float]] = {}


def require_proof_user(auth: AuthContext = Depends(current_auth)) -> User:
    return auth.user


async def enforce_proof_body_limit(request: Request) -> None:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_PROOF_BODY_BYTES:
                raise ProofError(
                    413,
                    "PAYLOAD_TOO_LARGE",
                    "Request payload exceeds the 1 MB limit.",
                )
        except ValueError:
            pass
    if request.method in ("POST", "PUT", "PATCH"):
        body = await request.body()
        if len(body) > MAX_PROOF_BODY_BYTES:
            raise ProofError(
                413,
                "PAYLOAD_TOO_LARGE",
                "Request payload exceeds the 1 MB limit.",
            )


def rate_limit_verify(request: Request) -> None:
    ip = client_ip(request)
    key = f"proof_verify:{ip}"
    now = time.monotonic()
    cutoff = now - VERIFY_WINDOW_SECONDS

    with _verify_lock:
        bucket = _verify_buckets.setdefault(key, deque())
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= VERIFY_MAX_REQUESTS_PER_MINUTE:
            retry_after = max(1, int(bucket[0] + VERIFY_WINDOW_SECONDS - now))
            raise ProofError(
                429,
                "RATE_LIMIT_EXCEEDED",
                "Rate limit exceeded. Maximum 60 verification requests per minute.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)


def reset_verify_rate_limits() -> None:
    with _verify_lock:
        _verify_buckets.clear()
