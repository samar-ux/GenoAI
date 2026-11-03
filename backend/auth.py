"""Register, login and current user."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter()


def _token_response(user: models.User) -> schemas.TokenOut:
    return schemas.TokenOut(
        access_token=create_access_token(user.id),
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/register", response_model=schemas.TokenOut, status_code=201)
def register(data: schemas.RegisterIn, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if data.email and db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.User(
        username=data.username,
        email=data.email,
        hashed_pw=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if user is None or not verify_password(data.password, user.hashed_pw):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return _token_response(user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
