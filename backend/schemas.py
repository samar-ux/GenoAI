"""Request and response schemas (Pydantic v2)."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Plan = Literal["basic", "pro", "ultra"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Auth / users ──────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.\-]+$")
    password: str = Field(min_length=8, max_length=128)
    email: Optional[EmailStr] = None


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORMModel):
    id: int
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    birth_day: Optional[int] = None
    birth_mon: Optional[int] = None
    birth_year: Optional[int] = None
    plan: str
    theme: str
    language: str
    spoken_language: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.\-]+$")
    email: Optional[EmailStr] = None
    birth_day: Optional[int] = Field(default=None, ge=1, le=31)
    birth_mon: Optional[int] = Field(default=None, ge=1, le=12)
    birth_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    theme: Optional[Literal["dark", "light"]] = None
    language: Optional[Literal["en", "ar"]] = None
    spoken_language: Optional[Literal["auto", "en", "ar"]] = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PlanUpdate(BaseModel):
    plan: Plan


# ── Chat / history ────────────────────────────────────────────────────────────
class ChatIn(BaseModel):
    conversation_id: Optional[int] = None
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(ORMModel):
    id: int
    conversation_id: int
    role: str
    msg_type: str
    content: Optional[str] = None
    media_url: Optional[str] = None
    duration_sec: Optional[int] = None
    created_at: datetime


class ChatOut(BaseModel):
    conversation_id: int
    user_message: MessageOut
    assistant_message: MessageOut


class ConversationOut(ORMModel):
    id: int
    title: str
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)
