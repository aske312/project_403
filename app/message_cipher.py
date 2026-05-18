import base64
import binascii
import hashlib
import hmac
import os

from app.setting.config import parameters as param

LEGACY_MESSAGE_PREFIX = "enc:v1:"
MESSAGE_PREFIX = "enc:v2:"
CLIENT_PREFIX = "wire:v1:"
SALT_BYTES = 16
MAC_BYTES = 32


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


def _decode_base64_urlsafe(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def encrypt_message_body(body: str) -> str:
    raw = body.encode("utf-8")
    salt = os.urandom(SALT_BYTES)
    encrypted = _xor_bytes(raw, salt)
    signed_payload = salt + encrypted
    signature = hmac.new(_key_material(), signed_payload, hashlib.sha256).digest()
    payload = base64.urlsafe_b64encode(signed_payload + signature).decode("ascii")
    return f"{MESSAGE_PREFIX}{payload}"


def _decrypt_v1(payload: str) -> str:
    raw = _decode_base64_urlsafe(payload)
    salt, encrypted = raw[:12], raw[12:]
    return _xor_bytes(encrypted, salt).decode("utf-8")


def _decrypt_v2(payload: str) -> str:
    raw = _decode_base64_urlsafe(payload)
    if len(raw) < SALT_BYTES + MAC_BYTES:
        raise ValueError("Encrypted message payload is too short.")

    signed_payload = raw[:-MAC_BYTES]
    expected_signature = raw[-MAC_BYTES:]
    actual_signature = hmac.new(_key_material(), signed_payload, hashlib.sha256).digest()
    if not hmac.compare_digest(actual_signature, expected_signature):
        raise ValueError("Encrypted message signature is invalid.")

    salt = signed_payload[:SALT_BYTES]
    encrypted = signed_payload[SALT_BYTES:]
    return _xor_bytes(encrypted, salt).decode("utf-8")


def decrypt_message_body(body: str) -> str:
    text = str(body or "")
    if text.startswith(MESSAGE_PREFIX):
        payload = text[len(MESSAGE_PREFIX):]
        try:
            return _decrypt_v2(payload)
        except (ValueError, UnicodeDecodeError, binascii.Error):
            return "[message unavailable]"

    if text.startswith(LEGACY_MESSAGE_PREFIX):
        payload = text[len(LEGACY_MESSAGE_PREFIX):]
        try:
            return _decrypt_v1(payload)
        except (ValueError, UnicodeDecodeError, binascii.Error):
            return "[message unavailable]"

    return text


def decode_client_payload(value: str) -> str:
    text = str(value or "")
    if not text.startswith(CLIENT_PREFIX):
        return text

    try:
        return _decode_base64_urlsafe(text[len(CLIENT_PREFIX):]).decode("utf-8")
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return ""
