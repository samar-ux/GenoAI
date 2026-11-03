# Geno AI

![Geno AI](frontend/public/logo.png)

An Arabic-first (RTL) AI assistant app: chat with text, voice, images and video, keep a conversation history, and manage your account, settings and plan. Dark interface with the brand colors `#333333` (background) and `#00A3FF` (accent).

> **Status:** work in progress. See the [roadmap](#roadmap) for what is done and what is planned.

## Features (from the Figma design)

- **Authentication:** login and sign up (username and password).
- **Chat:** text messages plus upload and microphone buttons in one input bar.
- **Voice messages:** record with a live waveform, cancel or send, and play back inside the chat.
- **Rich messages:** text, audio, image and video bubbles for both the user and the assistant.
- **History:** sidebar listing past conversations, and a button to start a new chat.
- **Account:** profile picture, username, password and birth date.
- **Settings:** dark theme toggle, interface language (English / Arabic), spoken language (Auto / English / Arabic), devices and plan management.
- **Plans:** three plan cards with an "Upgrade now" action (`basic`, `pro`, `ultra`).
- **Responsive:** separate mobile and desktop layouts.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Vite |
| Backend | FastAPI, Uvicorn |
| Database | SQLAlchemy models (`users`, `conversations`, `messages`) |

## API overview

All routes live under `/api`. Protected routes need the header `Authorization: Bearer <token>`.

| Method and path | Purpose |
|---|---|
| `POST /api/auth/register` | Create an account and get a token |
| `POST /api/auth/login` | Log in and get a token |
| `GET /api/auth/me` | Current user |
| `POST /api/chat` | Send a text message and get the AI reply (creates a conversation if `conversation_id` is omitted) |
| `POST /api/chat/upload` | Send a voice, image or video message (multipart) |
| `GET /api/history` | List the user's conversations |
| `GET /api/history/{id}` | Open a conversation with its messages |
| `PATCH /api/history/{id}` | Rename a conversation |
| `DELETE /api/history/{id}` | Delete a conversation |
| `GET /api/users/me` | Profile |
| `PATCH /api/users/me` | Update username, email, birth date, theme, language, spoken language |
| `POST /api/users/me/password` | Change password |
| `POST /api/users/me/avatar` | Upload a profile picture |
| `PATCH /api/users/me/plan` | Change plan (upgrades are disabled until payments are integrated) |

Interactive API docs are available at `/docs` when the server is running. Uploaded media is served from `/media`.

## Data model

- **User:** `username`, optional `email`, hashed password, `avatar_url`, birth date, `plan` (`basic` | `pro` | `ultra`), and settings (`theme`, `language`, `spoken_language`).
- **Conversation:** belongs to a user, has a `title`.
- **Message:** belongs to a conversation, with `role` (`user` | `assistant`), `msg_type` (`text` | `audio` | `image` | `video`), `content`, and for media messages `media_url` and `duration_sec`.

## Getting started

### Backend

Requires Python 3.10 or newer.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp ../.env.example .env        # then set SECRET_KEY (see the file for how to generate one)
pytest                         # run the API tests
uvicorn main:app --reload      # http://localhost:8000/docs
```

Without `ANTHROPIC_API_KEY` the chat runs in dev mode (the reply echoes your message). Add a key in `.env` to use the real AI.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Configuration

Copy `.env.example` to `.env` and set your own values. **Never commit `.env` or any API key.**

## Design

The full Figma flow (login, sign up, chat, voice, media messages, account, settings, plans) is in `docs/design/`.

## Roadmap

Backend (written, pending a first test run with `pytest`):

- [ ] Authentication: register, login, password hashing, JWT
- [ ] Chat endpoint connected to the LLM
- [ ] Voice, image and video message uploads
- [ ] Conversation history (list, open, rename, delete)
- [ ] Account and settings endpoints

Frontend and next steps:

- [ ] Login and sign up pages
- [ ] Chat page with the history sidebar
- [ ] Voice recording with waveform (microphone button)
- [ ] Image and video messages in the chat
- [ ] Account, settings and plans pages
- [ ] Arabic / English interface switching with RTL support
- [ ] Speech-to-text for voice messages and image understanding
- [ ] Payments for paid plans
- [ ] Rate limiting, deployment and CI

## Author

**Samar Mohamed**: Full-Stack Developer | AI & Automation | Power BI
[LinkedIn](https://www.linkedin.com/in/samar-mohamed-71a4b7178/) | samar7ux@gmail.com
