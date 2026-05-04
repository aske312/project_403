from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    handle: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    first_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32), default="user")
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    chats: Mapped[list["ChatMember"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    messages: Mapped[list["Message"]] = relationship(back_populates="sender")


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    members: Mapped[list["ChatMember"]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
    )


class ChatMember(Base):
    __tablename__ = "chat_members"
    __table_args__ = (
        UniqueConstraint("chat_id", "user_id", name="uq_chat_members_chat_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    chat: Mapped["Chat"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="chats")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    chat: Mapped["Chat"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship(back_populates="messages")
