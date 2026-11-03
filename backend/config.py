"""Central configuration, read from environment variables (.env)."""

import os

from dotenv import load_dotenv

load_dotenv()


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./geno.db")

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY.startswith("change-me"):
    raise RuntimeError(
        "SECRET_KEY is not set. Copy .env.example to .env and set SECRET_KEY, e.g. "
        'python -c "import secrets; print(secrets.token_urlsafe(48))"'
    )

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Frontend origins allowed to call the API (comma-separated). Vite's default dev URL.
CORS_ORIGINS = _csv(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

# LLM (Anthropic Messages API). Without a key the API replies in "dev mode".
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-haiku-5-5")

# Uploaded media (avatars, voice, image and video messages)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))

# Payments are not integrated yet. Keep False in production so users cannot self-upgrade.
ALLOW_FREE_PLAN_CHANGE = os.getenv("ALLOW_FREE_PLAN_CHANGE", "false").lower() == "true"
