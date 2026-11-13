# Launch checklist

Code is ready for a **closed beta**. These items need you (accounts, legal, real-world testing) and cannot be done from code.

## 1. Before anyone else uses it (1 day)
- [ ] Deploy (Render: `render.yaml`, persistent disk required for SQLite and backups). Set `JWT_SECRET` (auto), `ANTHROPIC_API_KEY`, `COMPANY_NAME`, `CONTACT_EMAIL`, `ADMIN_TOKEN`. In production the server refuses to start with a weak `JWT_SECRET`.
- [ ] Open `https://YOUR-DOMAIN/healthz` (should return `{"ok":true}`), `/privacy`, `/terms`, `/data-deletion`.
- [ ] Have a lawyer review `/privacy` and `/terms` (they are templates, in `backend/legal.js`).
- [ ] Run `npm --prefix backend test` (10 tests, Node 22+).
- [ ] Download one backup from `DATA_DIR/backups` and confirm it opens (`sqlite3 geno-YYYY-MM-DD.db .tables`). Copy backups off the server regularly: the same disk is not a backup.

## 2. Test real publishing with YOUR OWN accounts first
- [ ] Facebook: create a test Page, a Page token with `pages_manage_posts`, run one post, delete it.
- [ ] Telegram: create a bot with @BotFather, add it as admin of a test channel, run one post.
- [ ] Meta Ads: use your own ad account, one task with a 1-unit budget. Confirm campaign, ad set and ad appear **PAUSED** in Ads Manager, then delete them. Check `Results` after a day of delivery.
- [ ] Expired token: confirm the red error asks for a new token.

## 3. Meta app review (the real launch blocker for public users)
Pasting your own token works for you. For other people to connect their accounts you need a Meta app with **OAuth login** and approved permissions (`pages_manage_posts`, `pages_show_list`, `ads_management`), business verification, a privacy URL (`/privacy`) and a data-deletion URL (`/data-deletion`). Review takes days to weeks. Until then, run a closed beta where each user pastes their own tokens, or you connect accounts for them.

## 4. Operations
- [ ] Uptime monitor on `/healthz` (UptimeRobot or similar) with alerts to you.
- [ ] Watch logs for `[backup]`, `mk scheduler`, `[unhandledRejection]`.
- [ ] Decide support channel and put it in `CONTACT_EMAIL`.
- [ ] Set a spending alert on your Anthropic account.

## 5. Known limits
- SQLite + in-process scheduler = one server instance only. Move to Postgres and a job queue before scaling past a few hundred active users.
- Instagram, TikTok, Google Ads, email and WhatsApp tasks stay manual (copy and mark done).
- Results read Meta ad insights and Facebook post reactions/comments/shares; Telegram has no results.
- Payments are manual (InstaPay / Vodafone Cash) approved through the admin API.
