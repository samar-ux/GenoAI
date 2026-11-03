"""Saving uploaded files (avatars, voice, image and video messages)."""

import os
import uuid

from fastapi import HTTPException, UploadFile

import config

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
AUDIO_TYPES = {
    "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a", "audio/wav": ".wav", "audio/x-wav": ".wav",
}
VIDEO_TYPES = {"video/mp4": ".mp4", "video/webm": ".webm"}

_CHUNK = 1024 * 1024


def clean_mime(content_type: str | None) -> str:
    """'audio/webm;codecs=opus' -> 'audio/webm'"""
    return (content_type or "").split(";")[0].strip().lower()


def save_upload(file: UploadFile, allowed: dict[str, str], subdir: str, max_mb: int | None = None) -> str:
    """Validate type and size, store the file and return its public URL path."""
    ext = allowed.get(clean_mime(file.content_type))
    if ext is None:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    limit = (max_mb or config.MAX_UPLOAD_MB) * 1024 * 1024
    folder = os.path.join(config.UPLOAD_DIR, subdir)
    os.makedirs(folder, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, name)

    size = 0
    try:
        with open(path, "wb") as out:
            while True:
                chunk = file.file.read(_CHUNK)
                if not chunk:
                    break
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status_code=413, detail="File too large")
                out.write(chunk)
    except HTTPException:
        if os.path.exists(path):
            os.remove(path)
        raise
    return f"/media/{subdir}/{name}"
