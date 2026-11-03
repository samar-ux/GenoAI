"""Conversation history (sidebar): list, open, rename, delete."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import get_current_user

router = APIRouter()


def _owned_conversation(db: Session, user: models.User, conversation_id: int) -> models.Conversation:
    conversation = db.get(models.Conversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.get("", response_model=list[schemas.ConversationOut])
def list_conversations(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(models.Conversation)
        .filter(models.Conversation.user_id == user.id)
        .order_by(models.Conversation.id.desc())
        .all()
    )


@router.get("/{conversation_id}", response_model=schemas.ConversationDetail)
def get_conversation(
    conversation_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, user, conversation_id)
    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conversation.id)
        .order_by(models.Message.id.asc())
        .all()
    )
    return schemas.ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        messages=[schemas.MessageOut.model_validate(m) for m in messages],
    )


@router.patch("/{conversation_id}", response_model=schemas.ConversationOut)
def rename_conversation(
    conversation_id: int,
    data: schemas.ConversationRename,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, user, conversation_id)
    conversation.title = data.title
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _owned_conversation(db, user, conversation_id)
    db.delete(conversation)
    db.commit()
