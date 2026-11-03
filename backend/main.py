"""
GenoAI Backend — FastAPI
Run: uvicorn main:app --reload
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
import models  # noqa: F401  (registers the tables on Base)
from database import Base, engine
from routers import auth, chat, history, users

os.makedirs(config.UPLOAD_DIR, exist_ok=True)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="GenoAI API", version="1.0.0")

# ── CORS (allow the React frontend only) ───────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,   # set CORS_ORIGINS in .env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROUTERS ────────────────────────────────────────────────────────────────────
app.include_router(auth.router,    prefix="/api/auth",    tags=["Auth"])
app.include_router(chat.router,    prefix="/api/chat",    tags=["Chat"])
app.include_router(users.router,   prefix="/api/users",   tags=["Users"])
app.include_router(history.router, prefix="/api/history", tags=["History"])

# Uploaded media (voice / image / video messages and avatars)
app.mount("/media", StaticFiles(directory=config.UPLOAD_DIR), name="media")


@app.get("/")
def root():
    return {"message": "GenoAI API is running 🚀"}
