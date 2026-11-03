"""Account page and settings: profile, password, avatar, plan."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import config
import models
import schemas
import storage
from database import get_db
from security import get_current_user, hash_password, verify_password

router = APIRouter()


@router.get("/me", response_model=schemas.UserOut)
def get_profile(user: models.User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(
    data: schemas.UserUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    changes = data.model_dump(exclude_unset=True)

    new_username = changes.get("username")
    if new_username and new_username != user.username:
        if db.query(models.User).filter(models.User.username == new_username).first():
            raise HTTPException(status_code=409, detail="Username already taken")
    new_email = changes.get("email")
    if new_email and new_email != user.email:
        if db.query(models.User).filter(models.User.email == new_email).first():
            raise HTTPException(status_code=409, detail="Email already registered")

    for field, value in changes.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/password", status_code=204)
def change_password(
    data: schemas.PasswordChange,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, user.hashed_pw):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_pw = hash_password(data.new_password)
    db.commit()


@router.post("/me/avatar", response_model=schemas.UserOut)
def upload_avatar(
    file: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.avatar_url = storage.save_upload(file, storage.IMAGE_TYPES, subdir="avatars", max_mb=5)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/me/plan", response_model=schemas.UserOut)
def change_plan(
    data: schemas.PlanUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Downgrading to basic is always allowed. Upgrades need payments, which are not integrated yet."""
    if data.plan != "basic" and not config.ALLOW_FREE_PLAN_CHANGE:
        raise HTTPException(status_code=501, detail="Paid plans are not available yet")
    user.plan = data.plan
    db.commit()
    db.refresh(user)
    return user
