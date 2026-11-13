# Geno AI
  <img width="1280" height="640" alt="banner" src="https://github.com/user-attachments/assets/bc32d3b0-ed0f-4be2-bcdf-aa785f2973dd" />


An Arabic-first AI assistant with a built-in marketing workflow: save your brand once, get a 30-day execution plan, and publish only after you approve it. English and Arabic (RTL) interface.

> **Status: MVP, ready for a closed beta.** The backend test suite passes (`npm --prefix backend test`). Real Claude replies, publishing to Facebook / Telegram / Meta Ads, WhatsApp and payments need your own accounts and keys and have not been tested end to end. See [LAUNCH.md](LAUNCH.md) for the checklist.

<p align="center">
  <img src="docs/screenshots/brand-profile.png" alt="Brand profile screen with the Save brand button" width="720">
</p>

<p align="center">
 <img width="1100" height="720" alt="login" src="https://github.com/user-attachments/assets/d97d0f95-2bb2-41fd-95e7-c405bf619b8d" />
<img width="1100" height="720" alt="welcome" src="https://github.com/user-attachments/assets/3976dc8d-806d-4ab4-963b-b2fb7c783ca9" />

  <img width="1100" height="720" alt="brand-profile" src="https://github.com/user-attachments/assets/58995286-e756-4fc8-a7e1-023a0e6edf6d" />
<img width="390" height="780" alt="brand-profile-mobile" src="https://github.com/user-attachments/assets/cfa89f10-3e09-4bef-b1fb-cb43d4d8e4d2" />

</p>

<sub>Screenshots show the interface with sample data (a fictional brand).</sub>

---

Chat assistant with accounts, history, file/image/PDF uploads, voice messages, dark/light theme and English/Arabic UI.

## Run it

```bash
cp .env.example .env        # then fill in JWT_SECRET and ANTHROPIC_API_KEY
npm run setup               # installs backend dependencies (Node 20+)
npm start                   # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the app runs in demo mode (canned replies) so you can test the whole UI.

## Structure

```
backend/   Express + SQLite API (server.js, db.js, ai.js)
frontend/  Static app served by the backend (index.html, style.css, app.js, logo.png)
```

## API

| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/signup, /api/auth/login | `{username, password}` -> `{token, user}` |
| GET / PUT | /api/me | profile; PUT accepts username, password, birth, avatar, plan |
| GET | /api/chats | list |
| GET / DELETE | /api/chats/:id | messages / delete |
| DELETE | /api/chats | delete all |
| POST | /api/chat | multipart: `text`, `type` (text/voice), `chatId?`, `lang?`, `bars?`, `files[]`, `audio?` |

All routes except `/api/auth/*` need `Authorization: Bearer <token>`.

## How the main pieces work

- **AI:** `backend/ai.js` sends the last 30 messages to Claude. Images and PDFs are sent natively, text files are inlined, other files are mentioned by name only.
- **Voice:** the browser records audio and transcribes it with the Web Speech API (Chrome, Edge, Safari). The transcript is what Claude receives. Replies to voice messages are read aloud with browser text-to-speech.
- **Data:** SQLite file in `backend/data/`, uploads in `backend/uploads/` (random file names, served with a sandbox CSP).

## Features

| Feature | How it works |
|---|---|
| Personality | Settings > Personality: Serious, Funny (default), Roast. Prompts in `backend/ai.js` (`PERSONA_PROMPTS`). Meeting notes always stay serious. `/persona roast` on WhatsApp. |
| Arabic dialects | Settings > Dialect (Egyptian, Gulf, Levantine, MSA, Auto). Arabic/English mixed sentences are handled by the prompt. |
| Modes | General, Student, Business, Freelance, Gov. help, Meeting notes, English coach. Each mode is a system prompt in `backend/ai.js`. |
| Personal memory | Settings > Memory. Notes are stored per user, the most relevant chunks are added to the prompt (keyword search with Arabic normalisation in `backend/memory.js`). |
| Meeting notes | Choose "Meeting notes", send a voice or text message: you get Summary / Decisions / Action items / Follow-ups as text. |
| English coach | Short replies, corrections explained in Arabic, replies are read aloud. Corrections are text-based only, there is no pronunciation scoring. |
| Plans and quotas | Daily message limits per plan (`backend/plans.js`), enforced on the server. |
| Local payments | Manual flow: the user pays by InstaPay / Vodafone Cash and submits the transaction number. You approve it (see below). Plan lasts 30 days. |
| WhatsApp | Webhook at `/webhook/whatsapp`. Text, images and voice notes (voice needs `OPENAI_API_KEY`). Commands: `/mode student`, `/note some text`. |
| Better voice | Set `OPENAI_API_KEY` and the app transcribes on the server instead of the browser. |

### Digital marketing assistants

Six marketing modes (chips with 📣): **Strategy, Content, Media buying, Analytics, Video ads, SEO & GEO**. They use a **brand profile** (Settings > Brand profile: name, industry, audience, tone, selling points, competitors, goals) as the ground truth, so answers stay on-brand and the model is told not to invent other brand facts. This is prompt-based personalisation, not model training. Once saved, the profile is applied **automatically in every chat** (as background, used only when relevant) and always inside the marketing modes. The switch "Use automatically in all chats" turns the automatic use off for non-marketing chats. A chip with the brand name above the input shows that it is active.

- **Analytics:** upload a CSV export (Meta, Google, TikTok...) in the Analytics mode. `backend/analytics.js` finds the columns (spend, impressions, clicks, conversions, revenue), groups rows by ad / ad set / campaign, computes CTR, CVR, CPC, CPA and ROAS with code, and runs a two-proportion z-test between the top two items. Claude receives those exact numbers, so it does not do the arithmetic itself and it can say when a test has too little data.
- **Video ads:** writes hooks, timed scripts, shot lists and ready-to-paste prompts for AI video and voice tools (such as Veo, Higgsfield, ElevenLabs). It does not generate video or audio itself, and it refuses to write fake testimonials.
- **SEO & GEO:** content structure and signals that help search engines and AI assistants cite the brand, with an honest note that nothing is guaranteed.
- The roast personality is reduced to funny inside marketing modes.

### Approving payments

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" https://YOUR_APP/api/admin/payments
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" https://YOUR_APP/api/admin/payments/1/approve   # or /reject
```

### WhatsApp setup (Meta WhatsApp Cloud API)

1. Create a Meta developer app with the WhatsApp product and a business number.
2. Set the four `WHATSAPP_*` variables. `WHATSAPP_VERIFY_TOKEN` is any string you choose, `WHATSAPP_APP_SECRET` is the app secret from Meta.
3. In Meta, set the webhook URL to `https://YOUR_APP/webhook/whatsapp`, the verify token to your string, and subscribe to `messages`.
4. Every phone number becomes its own account (`wa_<number>`) with its own history, memory and daily quota.

## Tested and untested

Tested locally with scripted requests: signup/login, chats, uploads, memory search (Arabic and English), modes, quotas, plan approval, WhatsApp webhook verification, signature check and the receive-store-reply path. The page flows were exercised in a simulated browser.

Not tested because they need external accounts or keys: real Claude replies, OpenAI transcription, sending messages back through WhatsApp, and real payments.

## Not built yet

- Automatic payments (Fawry, cards, Stripe). Payments are manual review for now.
- Video understanding (videos are stored and played, but Claude only sees the file name).
- Password reset / email verification, streaming replies.
- Before going public: HTTPS, a strict CSP (helmet), object storage for uploads, and a managed database if you need more than one server.
- Government-procedure answers come from the model and can be outdated. The prompt tells it to say so, but verify before relying on it.

## Marketing execution plan (real publishing)

After saving the brand profile, press **Execution plan**. Geno builds a 30-day plan (goal, KPIs, 10-14 tasks). Nothing is published until you press **Run now** (two-step confirm) or **Approve & schedule**.

Connect channels in the plan screen (tokens are stored AES-256-GCM encrypted and never returned to the browser):
- **Facebook Page**: Page ID + Page access token (permission `pages_manage_posts`).
- **Telegram**: bot token from @BotFather, bot added as admin of your channel, channel `@username`.
- **Meta Ads**: ad account ID, Page ID, token with `ads_management`. Campaign, ad set, creative and ad are always created **PAUSED**; you review and switch them on in Ads Manager. One ad's daily budget is capped by `MK_MAX_DAILY_BUDGET`.

Tasks for Instagram, TikTok, Google Ads, SEO, email and WhatsApp stay "manual": copy the ready text and mark it done. Tasks containing `[placeholders]` never run until you fill them in. Scheduled tasks run from a 60-second in-process scheduler (the server must stay running). The Meta ad flow follows the Graph API v21 docs but needs a live test with your own account before relying on it.

## Launch readiness
See `LAUNCH.md`. Added for launch: production safety checks (`NODE_ENV=production` needs a strong `JWT_SECRET`), security headers, `/healthz`, daily SQLite backups (last 7), account export and permanent deletion, `/privacy` `/terms` `/data-deletion` pages, results from Meta and an AI review against the goal, and `npm --prefix backend test`.
