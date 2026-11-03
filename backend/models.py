"""
Models — جداول قاعدة البيانات
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(50), unique=True, index=True, nullable=False)
    email      = Column(String(120), unique=True, index=True, nullable=True)
    hashed_pw  = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    birth_day  = Column(Integer,  nullable=True)
    birth_mon  = Column(Integer,  nullable=True)
    birth_year = Column(Integer,  nullable=True)
    plan       = Column(String(20), default="basic")   # basic | pro | ultra
    # Settings screen
    theme           = Column(String(10), default="dark")   # dark | light
    language        = Column(String(5),  default="en")     # en | ar
    spoken_language = Column(String(5),  default="auto")   # auto | en | ar
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    conversations = relationship("Conversation", back_populates="user", cascade="all, delete")


class Conversation(Base):
    __tablename__ = "conversations"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title      = Column(String(200), default="New chat")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user     = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete")


class Message(Base):
    __tablename__ = "messages"

    id              = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    role            = Column(String(10), nullable=False)   # user | assistant
    msg_type        = Column(String(10), default="text")   # text | audio | image | video
    content         = Column(Text, nullable=True)
    media_url       = Column(String(500), nullable=True)   # audio / image / video file
    duration_sec    = Column(Integer, nullable=True)       # audio / video length
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    conversation = relationship("Conversation", back_populates="messages")
