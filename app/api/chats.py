from datetime import datetime
import json
import logging
from contextlib import suppress

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth.login import get_current_user, make_user_response
from app.db.models import Chat, ChatMember, Message, User
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
    own: bool


class ChatResponse(BaseModel):
    id: int
    title: str
    type: str = "direct"
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
            except RuntimeError:
                self.disconnect(user_id, socket)

    async def broadcast_to_chat_members(self, chat: Chat, payload: dict, *, except_user_id: int | None = None):
        for member in chat.members:
            if except_user_id is not None and member.user_id == except_user_id:
                continue
            await self.send_to_user(member.user_id, payload)


manager = ChatConnectionManager()


def make_member_response(user: User) -> ChatMemberResponse:
    return ChatMemberResponse(
        id=user.id,
        handle=user.handle,
        tag=f"@{user.handle}",
        name=user.name,
        role=user.role or "user",
        is_super_admin=bool(user.is_super_admin),
    )


def make_message_response(message: Message, current_user: User) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=message.id,
        chat_id=message.chat_id,
        sender=make_member_response(message.sender),
        body=decrypt_message_body(message.body),
        created_at=message.created_at,
        own=message.sender_id == current_user.id,
    )


def make_message_event(message: Message, receiver: User) -> dict:
    return {
        "type": "message",
        "message": make_message_response(message, receiver).model_dump(mode="json"),
    }


def get_chat_title(chat: Chat, current_user: User) -> str:
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


def get_message_text(payload: ChatMessageCreate) -> str:
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
        )
        .join(ChatMember)
        .where(Chat.id == chat_id, ChatMember.user_id == current_user.id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return chat


async def create_chat_message(db: AsyncSession, chat_id: int, text: str, current_user: User) -> tuple[Chat, Message]:
    chat = await get_user_chat(db, chat_id, current_user)
    message = Message(chat_id=chat.id, sender_id=current_user.id, body=encrypt_message_body(text))
    db.add(message)
    await db.commit()
    await db.refresh(message, attribute_names=["sender"])
    return chat, message


@router.get("")
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    ensure_dev_chat_enabled()
    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.members).selectinload(ChatMember.user),
            selectinload(Chat.messages).selectinload(Message.sender),
        )
        .join(ChatMember)
        .where(ChatMember.user_id == current_user.id)
        .order_by(Chat.created_at.asc())
    )
    chats = result.scalars().unique().all()

    return {
        "status": "ok",
        "mode": "dev_direct_messages_ws",
        "transport": "websocket",
        "message_security": {
            "storage": "encrypted_at_rest_v1",
            "wire": "encoded_payload_over_current_origin",
        },
        "user": make_user_response(current_user),
        "chats": [
            ChatResponse(
                id=chat.id,
                title=get_chat_title(chat, current_user),
                members=[make_member_response(member.user) for member in chat.members],
                last_message=make_message_response(chat.messages[-1], current_user) if chat.messages else None,
                messages=[make_message_response(message, current_user) for message in chat.messages[-50:]],
            )
            for chat in chats
        ],
    }


@router.post("/{chat_id}/messages")
async def create_message(
    chat_id: int,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    ensure_dev_chat_enabled()
    text = get_message_text(payload)
    chat, message = await create_chat_message(db, chat_id, text, current_user)
    response_message = make_message_response(message, current_user)

    for member in chat.members:
        receiver = member.user
        await manager.send_to_user(receiver.id, make_message_event(message, receiver))

    return {"status": "ok", "message": response_message}


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str = Query(default="")):
    if not is_dev_environment_name(param.ENVIRONMENTS):
        await websocket.close(code=1008)
        return

    async with SessionLocal() as db:
        current_user = await get_user_by_token(token, db)
        if not current_user:
            await websocket.close(code=1008)
            return

        await manager.connect(current_user.id, websocket)
        await websocket.send_json({"type": "ready", "user_id": current_user.id})

        try:
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
                    await manager.broadcast_to_chat_members(
                        chat,
                        {
                            "type": "typing",
                            "chat_id": chat.id,
                            "user": make_member_response(current_user).model_dump(mode="json"),
                            "typing": bool(payload.get("typing", True)),
                        },
                        except_user_id=current_user.id,
                    )
                    continue

                if event_type == "message":
                    text = decode_client_payload(payload.get("encoded_body") or payload.get("body") or "").strip()
                    if not text:
                        await websocket.send_json({"type": "error", "detail": "Message body is required."})
                        continue

                    chat, message = await create_chat_message(db, chat.id, text[:4000], current_user)
                    for member in chat.members:
                        receiver = member.user
                        await manager.send_to_user(receiver.id, make_message_event(message, receiver))
                    continue

                await websocket.send_json({"type": "error", "detail": "Unsupported event type."})
        except WebSocketDisconnect:
            manager.disconnect(current_user.id, websocket)
        except Exception as exc:
            logger.exception("Chat websocket failed: %s", exc)
            manager.disconnect(current_user.id, websocket)
            with suppress(Exception):
                await websocket.close(code=1011)
