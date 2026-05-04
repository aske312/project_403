from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth.login import get_current_user, make_user_response
from app.db.models import Chat, ChatMember, Message, User
from app.db.session import get_session
from app.setting.config import is_dev_environment_name, parameters as param

router = APIRouter(prefix="/api/chats", tags=["chats"])


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


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
        body=message.body,
        created_at=message.created_at,
        own=message.sender_id == current_user.id,
    )


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
        "mode": "dev_direct_messages",
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
    chat = await get_user_chat(db, chat_id, current_user)
    message = Message(chat_id=chat.id, sender_id=current_user.id, body=payload.body.strip())
    db.add(message)
    await db.commit()
    await db.refresh(message, attribute_names=["sender"])

    return {
        "status": "ok",
        "message": make_message_response(message, current_user),
    }
