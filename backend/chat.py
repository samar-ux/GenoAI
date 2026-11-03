"""Chat: text messages with an AI reply, and media (voice / image / video) uploads."""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

import llm
import models
import schemas
import storage
from database import get_db
from security import get_current_user

router = APIRouter()

HISTORY_LIMIT = 20  # last N text messages sent to the model as context


def _get_or_create_conversation(
    db: Session, user: models.User, conversation_id: Optional[int], first_text: str
) -> models.Conversation:
    if conversation_id is None:
        title = " ".join(first_text.split())[:40] or "New chat"
        conversation = models.Conversation(user_id=user.id, title=title)
        db.add(conversation)
        db.flush()
        return conversation

    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("", response_model=schemas.ChatOut)
def send_message(
    data: schemas.ChatIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _get_or_create_conversation(db, user, data.conversation_id, data.content)

    user_message = models.Message(
        conversation_id=conversation.id, role="user", msg_type="text", content=data.content
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    recent = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation.id, models.Message.msg_type == "text")
        .order_by(models.Message.id.desc())
        .limit(HISTORY_LIMIT)
        .all()
    )
    recent.reverse()
    context = [{"role": m.role, "content": m.content} for m in recent if m.content]

    try:
        reply_text = llm.generate_reply(context)
    except llm.LLMError:
        raise HTTPException(status_code=502, detail="The AI service is unavailable. Please try again.")

    assistant_message = models.Message(
        conversation_id=conversation.id, role="assistant", msg_type="text", content=reply_text
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    return schemas.ChatOut(
        conversation_id=conversation.id,
        user_message=schemas.MessageOut.model_validate(user_message),
        assistant_message=schemas.MessageOut.model_validate(assistant_message),
    )


@router.post("/upload", response_model=schemas.MessageOut, status_code=201)
def upload_media(
    file: UploadFile = File(...),
    conversation_id: Optional[int] = Form(None),
    duration_sec: Optional[int] = Form(None, ge=0),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store a voice / image / video message. (No AI reply yet: speech-to-text and vision come later.)"""
    mime = storage.clean_mime(file.content_type)
    if mime in storage.IMAGE_TYPES:
        msg_type, allowed = "image", storage.IMAGE_TYPES
    elif mime in storage.AUDIO_TYPES:
        msg_type, allowed = "audio", storage.AUDIO_TYPES
    elif mime in storage.VIDEO_TYPES:
        msg_type, allowed = "video", storage.VIDEO_TYPES
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    conversation = _get_or_create_conversation(db, user, conversation_id, "New chat")
    url = storage.save_upload(file, allowed, subdir=msg_type)

    message = models.Message(
        conversation_id=conversation.id,
        role="user",
        msg_type=msg_type,
        media_url=url,
        duration_sec=duration_sec,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
