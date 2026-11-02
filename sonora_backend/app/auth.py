import base64
import hashlib
import hmac
import json
import time
from typing import Dict, Any
from .config import settings


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def create_jwt_token(
    subject: str,
    role: str = "operator",
    telegram_chat_id: str | None = None,
    expires_delta_seconds: int | None = None,
) -> str:
    now = int(time.time())
    exp = now + (expires_delta_seconds or settings.jwt_expire_minutes * 60)
    header = {"alg": "HS256", "typ": "JWT"}
    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "telegram_chat_id": telegram_chat_id,
        "iat": now,
        "exp": exp,
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"


def verify_jwt_token(token: str) -> Dict[str, Any]:
    parts = (token or "").strip().split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format.")
    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    actual_sig = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid JWT signature.")
    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("JWT token has expired.")
    return payload
