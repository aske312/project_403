import base64
import hashlib
import hmac

from app.setting.config import parameters as param

MESSAGE_PREFIX = "enc:v1:"
CLIENT_PREFIX = "wire:v1:"


def _key_material() -> bytes:
    secret = getattr(param, "MESSAGE_SECRET", None) or param.JWT_SECRET
    return hashlib.sha256(str(secret).encode("utf-8")).digest()


def _keystream(length: int, salt: bytes) -> bytes:
    key = _key_material()
    chunks = []
    counter = 0
    while sum(len(chunk) for chunk in chunks) < length:
        chunks.append(hmac.new(key, salt + counter.to_bytes(4, "big"), hashlib.sha256).digest())
        counter += 1
    return b"".join(chunks)[:length]


def _xor_bytes(data: bytes, salt: bytes) -> bytes:
    stream = _keystream(len(data), salt)
    return bytes(left ^ right for left, right in zip(data, stream))


def encrypt_message_body(body: str) -> str:
    raw = body.encode("utf-8")
    salt = hashlib.sha256(raw + _key_material()).digest()[:12]
    encrypted = _xor_bytes(raw, salt)
    payload = base64.urlsafe_b64encode(salt + encrypted).decode("ascii")
    return f"{MESSAGE_PREFIX}{payload}"


def decrypt_message_body(body: str) -> str:
    if not str(body or "").startswith(MESSAGE_PREFIX):
        return body or ""

    payload = body[len(MESSAGE_PREFIX):]
    try:
        raw = base64.urlsafe_b64decode(payload.encode("ascii"))
        salt, encrypted = raw[:12], raw[12:]
        return _xor_bytes(encrypted, salt).decode("utf-8")
    except Exception:
        return "[message unavailable]"


def decode_client_payload(value: str) -> str:
    text = str(value or "")
    if not text.startswith(CLIENT_PREFIX):
        return text

    try:
        return base64.urlsafe_b64decode((text[len(CLIENT_PREFIX):] + "=" * (-len(text[len(CLIENT_PREFIX):]) % 4)).encode("ascii")).decode("utf-8")
    except Exception:
        return ""
