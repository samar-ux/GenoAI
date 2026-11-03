"""API tests. Run from the backend folder:  pytest"""

import os
import tempfile

# Configure the app for testing BEFORE importing it.
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-0123456789-abcdef"
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp()
os.environ["ANTHROPIC_API_KEY"] = ""          # force dev-mode replies
os.environ["ALLOW_FREE_PLAN_CHANGE"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402

client = TestClient(app)


def register(username, password="password123", email=None):
    body = {"username": username, "password": password}
    if email:
        body["email"] = email
    return client.post("/api/auth/register", json=body)


def auth_headers(username):
    token = register(username).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── auth ──────────────────────────────────────────────────────────────────────
def test_register_and_login():
    r = register("samar")
    assert r.status_code == 201
    assert r.json()["user"]["username"] == "samar"
    assert "hashed_pw" not in r.json()["user"]

    ok = client.post("/api/auth/login", json={"username": "samar", "password": "password123"})
    assert ok.status_code == 200 and ok.json()["access_token"]

    bad = client.post("/api/auth/login", json={"username": "samar", "password": "wrong-pass"})
    assert bad.status_code == 401


def test_duplicate_username_rejected():
    register("dupuser")
    assert register("dupuser").status_code == 409


def test_weak_password_rejected():
    assert register("shortpw", password="123").status_code == 422


def test_protected_routes_need_token():
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/history").status_code == 401
    assert client.post("/api/chat", json={"content": "hi"}).status_code == 401


def test_me_returns_current_user():
    headers = auth_headers("meuser")
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200 and r.json()["username"] == "meuser"


# ── chat + history ────────────────────────────────────────────────────────────
def test_chat_creates_conversation_and_replies():
    headers = auth_headers("chatter")
    r = client.post("/api/chat", json={"content": "Hello Geno"}, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["user_message"]["role"] == "user"
    assert data["assistant_message"]["role"] == "assistant"
    assert "Hello Geno" in data["assistant_message"]["content"]   # dev-mode echo

    # second message goes into the same conversation
    r2 = client.post(
        "/api/chat",
        json={"conversation_id": data["conversation_id"], "content": "Again"},
        headers=headers,
    )
    assert r2.status_code == 200
    assert r2.json()["conversation_id"] == data["conversation_id"]


def test_arabic_message():
    headers = auth_headers("arabicuser")
    r = client.post("/api/chat", json={"content": "مرحبا جينو"}, headers=headers)
    assert r.status_code == 200
    assert "مرحبا جينو" in r.json()["assistant_message"]["content"]


def test_history_list_open_rename_delete():
    headers = auth_headers("historyuser")
    conv_id = client.post("/api/chat", json={"content": "First question"}, headers=headers).json()["conversation_id"]

    listing = client.get("/api/history", headers=headers).json()
    assert [c["id"] for c in listing] == [conv_id]
    assert listing[0]["title"] == "First question"

    detail = client.get(f"/api/history/{conv_id}", headers=headers).json()
    assert len(detail["messages"]) == 2

    renamed = client.patch(f"/api/history/{conv_id}", json={"title": "Renamed"}, headers=headers)
    assert renamed.status_code == 200 and renamed.json()["title"] == "Renamed"

    assert client.delete(f"/api/history/{conv_id}", headers=headers).status_code == 204
    assert client.get(f"/api/history/{conv_id}", headers=headers).status_code == 404


def test_users_cannot_access_each_others_conversations():
    owner = auth_headers("owner1")
    intruder = auth_headers("intruder1")
    conv_id = client.post("/api/chat", json={"content": "secret"}, headers=owner).json()["conversation_id"]

    assert client.get(f"/api/history/{conv_id}", headers=intruder).status_code == 404
    assert client.delete(f"/api/history/{conv_id}", headers=intruder).status_code == 404
    r = client.post("/api/chat", json={"conversation_id": conv_id, "content": "hi"}, headers=intruder)
    assert r.status_code == 404


# ── account / settings ────────────────────────────────────────────────────────
def test_update_profile_and_settings():
    headers = auth_headers("profileuser")
    r = client.patch(
        "/api/users/me",
        json={"birth_day": 5, "birth_mon": 3, "birth_year": 1995, "language": "ar", "theme": "light"},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert (body["birth_day"], body["birth_mon"], body["birth_year"]) == (5, 3, 1995)
    assert body["language"] == "ar" and body["theme"] == "light"


def test_invalid_setting_rejected():
    headers = auth_headers("badsetting")
    assert client.patch("/api/users/me", json={"language": "fr"}, headers=headers).status_code == 422


def test_change_password():
    headers = auth_headers("pwuser")
    wrong = client.post("/api/users/me/password",
                        json={"current_password": "nope-nope", "new_password": "newpassword1"}, headers=headers)
    assert wrong.status_code == 400
    ok = client.post("/api/users/me/password",
                     json={"current_password": "password123", "new_password": "newpassword1"}, headers=headers)
    assert ok.status_code == 204
    login = client.post("/api/auth/login", json={"username": "pwuser", "password": "newpassword1"})
    assert login.status_code == 200


def test_plan_upgrade_not_available_without_payments():
    headers = auth_headers("planuser")
    assert client.patch("/api/users/me/plan", json={"plan": "pro"}, headers=headers).status_code == 501
    assert client.patch("/api/users/me/plan", json={"plan": "basic"}, headers=headers).status_code == 200


# ── media ─────────────────────────────────────────────────────────────────────
def test_upload_audio_message():
    headers = auth_headers("audiouser")
    r = client.post(
        "/api/chat/upload",
        files={"file": ("voice.webm", b"fake-audio-bytes", "audio/webm;codecs=opus")},
        data={"duration_sec": "3"},
        headers=headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["msg_type"] == "audio" and body["duration_sec"] == 3
    assert body["media_url"].startswith("/media/audio/")
    # the stored file is served back
    assert client.get(body["media_url"]).content == b"fake-audio-bytes"


def test_upload_rejects_unsupported_type():
    headers = auth_headers("exeuser")
    r = client.post(
        "/api/chat/upload",
        files={"file": ("virus.exe", b"MZ...", "application/x-msdownload")},
        headers=headers,
    )
    assert r.status_code == 415


def test_avatar_upload():
    headers = auth_headers("avataruser")
    r = client.post(
        "/api/users/me/avatar",
        files={"file": ("me.png", b"\x89PNG fake", "image/png")},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["avatar_url"].startswith("/media/avatars/")
