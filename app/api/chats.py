from datetime import datetime, timezone
import json
import logging
from contextlib import suppress

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth.login import get_current_user, make_user_response
from app.db.models import Chat, ChatMember, Message, MessageHidden, User
from app.db.session import SessionLocal, get_session
from app.message_cipher import decode_client_payload, decrypt_message_body, encrypt_message_body
from app.setting.config import is_dev_environment_name, parameters as param

router = APIRouter(prefix="/api/chats", tags=["chats"])
logger = logging.getLogger(__name__)


class ChatMessageCreate(BaseModel):
    body: str | None = Field(default=None, max_length=8000)
    encoded_body: str | None = Field(default=None, max_length=12000)


class ChatTypingEvent(BaseModel):
    chat_id: int
    typing: bool = True


class ChatRenamePayload(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ChatPinPayload(BaseModel):
    pinned: bool = True
    pin_order: int | None = None


class MessageEditPayload(BaseModel):
    body: str | None = Field(default=None, max_length=8000)
    encoded_body: str | None = Field(default=None, max_length=12000)


class MessageDeletePayload(BaseModel):
    scope: str = Field(default="self", pattern="^(self|all)$")


class ChatMemberResponse(BaseModel):
    id: int
    handle: str
    tag: str
    name: str
    role: str
    is_super_admin: bool


class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    sender: ChatMemberResponse
    body: str
    created_at: datetime
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    edited_at: datetime | None = None
    deleted_for_all_at: datetime | None = None
    own: bool
    status: str = "sent"


class ChatResponse(BaseModel):
    id: int
    title: str
    type: str = "direct"
    custom_title: str | None = None
    is_pinned: bool = False
    pin_order: int = 0
    members: list[ChatMemberResponse]
    last_message: ChatMessageResponse | None = None
    messages: list[ChatMessageResponse] = []


class ChatConnectionManager:
    def __init__(self):
        self.active: dict[int, set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        sockets = self.active.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self.active.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict):
        sockets = list(self.active.get(user_id, set()))
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except (RuntimeError, WebSocketDisconnect, Exception):
                self.disconnect(user_id, socket)

    async def broadcast_to_chat_members(self, chat: Chat, payload: dict, *, except_user_id: int | None = None):
        for member in chat.members:
            if except_user_id is not None and member.user_id == except_user_id:
                continue
            await self.send_to_user(member.user_id, payload)


manager = ChatConnectionManager()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def make_member_response(user: User) -> ChatMemberResponse:
    return ChatMemberResponse(
        id=user.id,
        handle=user.handle,
        tag=f"@{user.handle}",
        name=user.name,
        role=user.role or "user",
        is_super_admin=bool(user.is_super_admin),
    )


def get_message_status(message: Message, current_user: User) -> str:
    if message.sender_id != current_user.id:
        return "received"
    if message.read_at:
        return "read"
    if message.delivered_at:
        return "delivered"
    return "sent"


def make_message_response(message: Message, current_user: User) -> ChatMessageResponse:
    hidden = any(hidden.user_id == current_user.id for hidden in getattr(message, "hidden_for", []) or [])
    deleted_for_all = bool(message.deleted_for_all_at)
    body = ""
    if deleted_for_all:
        body = "Сообщение удалено"
    elif hidden:
        body = "Сообщение удалено для вас"
    else:
        body = decrypt_message_body(message.body)

    return ChatMessageResponse(
        id=message.id,
        chat_id=message.chat_id,
        sender=make_member_response(message.sender),
        body=body,
        created_at=message.created_at,
        delivered_at=message.delivered_at,
        read_at=message.read_at,
        edited_at=message.edited_at,
        deleted_for_all_at=message.deleted_for_all_at,
        own=message.sender_id == current_user.id,
        status=get_message_status(message, current_user),
    )


def make_message_event(message: Message, receiver: User, event_type: str = "message") -> dict:
    return {
        "type": event_type,
        "message": make_message_response(message, receiver).model_dump(mode="json"),
    }


def get_current_chat_member(chat: Chat, current_user: User) -> ChatMember | None:
    return next((member for member in chat.members if member.user_id == current_user.id), None)


def get_chat_title(chat: Chat, current_user: User) -> str:
    current_member = get_current_chat_member(chat, current_user)
    if current_member and current_member.custom_title:
        return current_member.custom_title
    if chat.title:
        return chat.title

    other_members = [member.user.name for member in chat.members if member.user_id != current_user.id]
    return ", ".join(other_members) or "Saved messages"


def ensure_dev_chat_enabled():
    if not is_dev_environment_name(param.ENVIRONMENTS):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat API is available only for DEV builds at this stage.",
        )


def get_message_text(payload: ChatMessageCreate | MessageEditPayload) -> str:
    text = decode_client_payload(payload.encoded_body or payload.body or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message body is required.")
    if len(text) > 4000:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message body is too long.")
    return text


async def get_user_by_token(token: str, db: AsyncSession) -> User | None:
    try:
        payload = jwt.decode(token, param.JWT_SECRET, algorithms=[param.JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    return await db.get(User, user_id)


async def get_user_chat(db: AsyncSession, chat_id: int, current_user: User) -> Chat:
    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.members).selectinload(ChatMember.user),
            selectinload(Chat.messages).selectinload(Message.sender),
            selectinload(Chat.messages).selectinload(Message.hidden_for),
        )
        .join(ChatMember)
        .where(Chat.id == chat_id, ChatMember.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return chat


async def get_user_message(db: AsyncSession, message_id: int, current_user: User) -> tuple[Chat, Message]:
    result = await db.execute(
        select(Message)
        .options(
            selectinload(Message.sender),
            selectinload(Message.hidden_for),
            selectinload(Message.chat).selectinload(Chat.members).selectinload(ChatMember.user),
        )
        .join(Chat, Chat.id == Message.chat_id)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .where(Message.id == message_id, ChatMember.user_id == current_user.id)
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
    return message.chat, message


async def create_chat_message(db: AsyncSession, chat_id: int, text: str, current_user: User) -> tuple[Chat, Message]:
    chat = await get_user_chat(db, chat_id, current_user)
    message = Message(chat_id=chat.id, sender_id=current_user.id, body=encrypt_message_body(text))
    if any(member.user_id != current_user.id for member in chat.members):
        message.delivered_at = now_utc()
    db.add(message)
    await db.commit()
    await db.refresh(message, attribute_names=["sender", "hidden_for"])
    return chat, message


def serialize_chat(chat: Chat, current_user: User) -> ChatResponse:
    member = get_current_chat_member(chat, current_user)
    visible_messages = [message for message in chat.messages if not any(hidden.user_id == current_user.id for hidden in getattr(message, "hidden_for", []) or [])]
    return ChatResponse(
        id=chat.id,
        title=get_chat_title(chat, current_user),
        custom_title=member.custom_title if member else None,
        is_pinned=bool(member.is_pinned) if member else False,
        pin_order=member.pin_order if member else 0,
        members=[make_member_response(member_row.user) for member_row in chat.members],
        last_message=make_message_response(visible_messages[-1], current_user) if visible_messages else None,
        messages=[make_message_response(message, current_user) for message in visible_messages[-80:]],
    )


@router.get("")
async def list_chats(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.members).selectinload(ChatMember.user),
            selectinload(Chat.messages).selectinload(Message.sender),
            selectinload(Chat.messages).selectinload(Message.hidden_for),
        )
        .join(ChatMember)
        .where(ChatMember.user_id == current_user.id)
        .order_by(ChatMember.is_pinned.desc(), ChatMember.pin_order.asc(), Chat.created_at.asc())
    )
    chats = result.scalars().unique().all()
    return {
        "status": "ok",
        "mode": "dev_direct_messages_ws" if param.WEBSOCKET_ENABLED else "dev_direct_messages_http",
        "transport": "websocket" if param.WEBSOCKET_ENABLED else "http_fallback",
        "message_security": {"storage": "encrypted_at_rest_v1", "wire": "encoded_payload_over_current_origin"},
        "user": make_user_response(current_user),
        "chats": [serialize_chat(chat, current_user).model_dump(mode="json") for chat in chats],
    }


@router.get("/contacts")
async def list_contacts(q: str = Query(default=""), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    query = q.strip().lower()
    users_result = await db.execute(select(User).order_by(User.name.asc()))
    users = users_result.scalars().all()
    contacts = []
    for user in users:
        haystack = f"{user.name} @{user.handle} {user.email}".lower()
        if query and query not in haystack:
            continue
        contacts.append(make_member_response(user).model_dump(mode="json"))
    return {"status": "ok", "contacts": contacts}


@router.post("/{chat_id}/messages")
async def create_message(chat_id: int, payload: ChatMessageCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    text = get_message_text(payload)
    chat, message = await create_chat_message(db, chat_id, text, current_user)
    response_message = make_message_response(message, current_user)
    for member in chat.members:
        await manager.send_to_user(member.user_id, make_message_event(message, member.user))
    return {"status": "ok", "message": response_message}


@router.patch("/{chat_id}")
async def rename_chat(chat_id: int, payload: ChatRenamePayload, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    chat = await get_user_chat(db, chat_id, current_user)
    member = get_current_chat_member(chat, current_user)
    if not member:
        raise HTTPException(status_code=404, detail="Chat member not found.")
    member.custom_title = payload.title.strip()
    await db.commit()
    await db.refresh(chat)
    event = {"type": "chat_updated", "chat_id": chat.id, "title": member.custom_title}
    await manager.send_to_user(current_user.id, event)
    return {"status": "ok", "chat": serialize_chat(chat, current_user).model_dump(mode="json")}


@router.patch("/{chat_id}/pin")
async def pin_chat(chat_id: int, payload: ChatPinPayload, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    chat = await get_user_chat(db, chat_id, current_user)
    member = get_current_chat_member(chat, current_user)
    if not member:
        raise HTTPException(status_code=404, detail="Chat member not found.")
    member.is_pinned = payload.pinned
    if payload.pin_order is not None:
        member.pin_order = payload.pin_order
    elif payload.pinned and not member.pin_order:
        member.pin_order = 1
    await db.commit()
    await db.refresh(chat)
    await manager.send_to_user(current_user.id, {"type": "chat_updated", "chat_id": chat.id})
    return {"status": "ok", "chat": serialize_chat(chat, current_user).model_dump(mode="json")}


@router.patch("/messages/{message_id}")
async def edit_message(message_id: int, payload: MessageEditPayload, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    chat, message = await get_user_message(db, message_id, current_user)
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only sender can edit this message.")
    if message.deleted_for_all_at:
        raise HTTPException(status_code=409, detail="Deleted message cannot be edited.")
    message.body = encrypt_message_body(get_message_text(payload))
    message.edited_at = now_utc()
    await db.commit()
    await db.refresh(message, attribute_names=["sender", "hidden_for"])
    for member in chat.members:
        await manager.send_to_user(member.user_id, make_message_event(message, member.user, "message_edited"))
    return {"status": "ok", "message": make_message_response(message, current_user)}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: int, payload: MessageDeletePayload, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    chat, message = await get_user_message(db, message_id, current_user)
    if payload.scope == "all":
        if message.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only sender can delete message for everyone.")
        message.deleted_for_all_at = now_utc()
    else:
        exists = await db.scalar(select(MessageHidden).where(and_(MessageHidden.message_id == message.id, MessageHidden.user_id == current_user.id)))
        if not exists:
            db.add(MessageHidden(message_id=message.id, user_id=current_user.id))
    await db.commit()
    await db.refresh(message, attribute_names=["sender", "hidden_for"])
    event_type = "message_deleted_all" if payload.scope == "all" else "message_deleted_self"
    if payload.scope == "all":
        for member in chat.members:
            await manager.send_to_user(member.user_id, make_message_event(message, member.user, event_type))
    else:
        await manager.send_to_user(current_user.id, make_message_event(message, current_user, event_type))
    return {"status": "ok", "scope": payload.scope, "message": make_message_response(message, current_user)}


@router.post("/{chat_id}/read")
async def mark_chat_read(chat_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_session)):
    ensure_dev_chat_enabled()
    chat = await get_user_chat(db, chat_id, current_user)
    changed = []
    stamp = now_utc()
    for message in chat.messages:
        if message.sender_id != current_user.id and not message.read_at:
            message.read_at = stamp
            changed.append(message)
    await db.commit()
    for message in changed:
        await db.refresh(message, attribute_names=["sender", "hidden_for"])
        for member in chat.members:
            await manager.send_to_user(member.user_id, make_message_event(message, member.user, "message_read"))
    return {"status": "ok", "updated": len(changed)}


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str = Query(default="")):
    if not is_dev_environment_name(param.ENVIRONMENTS) or not param.WEBSOCKET_ENABLED:
        await websocket.close(code=1008)
        return

    async with SessionLocal() as db:
        current_user = await get_user_by_token(token, db)
        if not current_user:
            await websocket.close(code=1008)
            return

        try:
            await manager.connect(current_user.id, websocket)
            await websocket.send_json({"type": "ready", "user_id": current_user.id})
            while True:
                raw = await websocket.receive_text()
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "detail": "Invalid JSON."})
                    continue
                event_type = payload.get("type")
                chat_id = int(payload.get("chat_id") or 0)
                if not chat_id:
                    await websocket.send_json({"type": "error", "detail": "chat_id is required."})
                    continue
                chat = await get_user_chat(db, chat_id, current_user)
                if event_type == "typing":
                    await manager.broadcast_to_chat_members(chat, {"type": "typing", "chat_id": chat.id, "user": make_member_response(current_user).model_dump(mode="json"), "typing": bool(payload.get("typing", True))}, except_user_id=current_user.id)
                    continue
                if event_type == "message":
                    text = decode_client_payload(payload.get("encoded_body") or payload.get("body") or "").strip()
                    if not text:
                        await websocket.send_json({"type": "error", "detail": "Message body is required."})
                        continue
                    chat, message = await create_chat_message(db, chat.id, text[:4000], current_user)
                    for member in chat.members:
                        await manager.send_to_user(member.user_id, make_message_event(message, member.user))
                    continue
                await websocket.send_json({"type": "error", "detail": "Unsupported event type."})
        except WebSocketDisconnect:
            logger.info("Chat websocket disconnected: user_id=%s", current_user.id)
        except Exception as exc:
            logger.warning("Chat websocket closed after client disconnect or protocol error: %s", exc)
            with suppress(Exception):
                await websocket.close(code=1011)
        finally:
            manager.disconnect(current_user.id, websocket)
