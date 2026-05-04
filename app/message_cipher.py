import base64
import hashlib
import hmac
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.setting.config import parameters as param

MESSAGE_PREFIX_V1 = "enc:v1:"
MESSAGE_PREFIX_V2 = "enc:v2:"
CLIENT_PREFIX = "wire:v1:"


def _root_secret() -> bytes:
    secret = getattr(param, "MESSAGE_SECRET", None) or param.JWT_SECRET
    return str(secret).encode("utf-8")


def _legacy_key_material() -> bytes:
    return hashlib.sha256(_root_secret()).digest()


def _chat_context(chat_id: int | None = None, member_ids: list[int] | tuple[int, ...] | None = None) -> str:
    normalized_members = ",".join(str(item) for item in sorted(member_ids or []))
    return f"chat:{chat_id or 0}:members:{normalized_members}"


@lru_cache(maxsize=512)
def _fernet_for_context(context: str) -> Fernet:
    raw_key = hmac.new(_root_secret(), context.encode("utf-8"), hashlib.sha256).digest()
    return Fernet(base64.urlsafe_b64encode(raw_key))


def _keystream(length: int, salt: bytes) -> bytes:
    key = _legacy_key_material()
    chunks = []
    counter = 0
    while sum(len(chunk) for chunk in chunks) < length:
        chunks.append(hmac.new(key, salt + counter.to_bytes(4, "big"), hashlib.sha256).digest())
        counter += 1
    return b"".join(chunks)[:length]


def _xor_bytes(data: bytes, salt: bytes) -> bytes:
    stream = _keystream(len(data), salt)
    return bytes(left ^ right for left, right in zip(data, stream))


def _encrypt_legacy_message_body(body: str) -> str:
    raw = body.encode("utf-8")
    salt = hashlib.sha256(raw + _legacy_key_material()).digest()[:12]
    encrypted = _xor_bytes(raw, salt)
    payload = base64.urlsafe_b64encode(salt + encrypted).decode("ascii")
    return f"{MESSAGE_PREFIX_V1}{payload}"


def _decrypt_legacy_message_body(body: str) -> str:
    payload = body[len(MESSAGE_PREFIX_V1):]
    raw = base64.urlsafe_b64decode(payload.encode("ascii"))
    salt, encrypted = raw[:12], raw[12:]
    return _xor_bytes(encrypted, salt).decode("utf-8")


def encrypt_message_body(
    body: str,
    *,
    chat_id: int | None = None,
    member_ids: list[int] | tuple[int, ...] | None = None,
) -> str:
    context = _chat_context(chat_id, member_ids)
    token = _fernet_for_context(context).encrypt(str(body or "").encode("utf-8")).decode("ascii")
    return f"{MESSAGE_PREFIX_V2}{token}"


def decrypt_message_body(
    body: str,
    *,
    chat_id: int | None = None,
    member_ids: list[int] | tuple[int, ...] | None = None,
) -> str:
    text = str(body or "")
    if text.startswith(MESSAGE_PREFIX_V2):
        token = text[len(MESSAGE_PREFIX_V2):].encode("ascii")
        context = _chat_context(chat_id, member_ids)
        try:
            return _fernet_for_context(context).decrypt(token).decode("utf-8")
        except InvalidToken:
            return "[message unavailable]"
        except Exception:
            return "[message unavailable]"

    if text.startswith(MESSAGE_PREFIX_V1):
        try:
            return _decrypt_legacy_message_body(text)
        except Exception:
            return "[message unavailable]"

    return text


def decode_client_payload(value: str) -> str:
    text = str(value or "")
    if not text.startswith(CLIENT_PREFIX):
        return text

    try:
        payload = text[len(CLIENT_PREFIX):]
        return base64.urlsafe_b64decode((payload + "=" * (-len(payload) % 4)).encode("ascii")).decode("utf-8")
    except Exception:
        return ""
