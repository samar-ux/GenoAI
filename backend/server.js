const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const db = require("./db");
const { converse, HttpError, UPLOADS, MODES, DIALECTS, PERSONAS, msgOut } = require("./core");
const { PLANS, CURRENCY, effectivePlan, usage } = require("./plans");
const memory = require("./memory");
const brandStore = require("./brand");
const stt = require("./stt");
const marketing = require("./marketing");

const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === "production";
if (PROD && (process.env.JWT_SECRET || "").length < 32) { console.error("[fatal] Set JWT_SECRET (32+ random characters) in production. Login tokens and stored channel tokens depend on it."); process.exit(1); }
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn("[warn] JWT_SECRET is not set: using a random one, logins reset on every restart.");
  return crypto.randomBytes(32).toString("hex");
})();
process.on("unhandledRejection", e => console.error("[unhandledRejection]", e));
process.on("uncaughtException", e => { console.error("[uncaughtException]", e); });

const app = express();
app.set("trust proxy", 1); // running behind a hosting proxy (Render, Railway, ...)
app.disable("x-powered-by");
app.use((req, res, next) => { // basic security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
  if (PROD) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("/healthz", (req, res) => { try { db.prepare("SELECT 1").get(); res.json({ ok: true }); } catch (e) { res.status(503).json({ ok: false }); } });
app.use(express.json({ limit: "400kb", verify: (req, res, buf) => { req.rawBody = buf; } }));

/* ---------- helpers ---------- */
const getUser = id => db.prepare("SELECT * FROM users WHERE id = ?").get(id);
const publicUser = u => ({ username: u.username, birth: u.birth, avatar: u.avatar, plan: effectivePlan(u), planUntil: u.plan_until, usage: usage(u) });
const sign = u => jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: "30d" });
const USERNAME = /^[\w.-]{3,30}$/;
const badUsername = n => !USERNAME.test(n) ? "Username must be 3-30 characters: letters, numbers, . _ -" : /^wa_/i.test(n) ? "This username prefix is reserved" : null;
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function auth(req, res, next) {
  try {
    const payload = jwt.verify((req.headers.authorization || "").replace(/^Bearer /, ""), JWT_SECRET);
    const u = getUser(payload.id);
    if (!u) throw new Error("no user");
    req.user = u; next();
  } catch (e) { res.status(401).json({ error: "Please log in again" }); }
}
const adminOnly = (req, res, next) => {
  const t = process.env.ADMIN_TOKEN || "", given = req.get("x-admin-token") || "";
  if (!t || !same(t, given)) return res.sendStatus(403);
  next();
};
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts, try again later" } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: "You are sending messages too fast" } });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8))
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 6 }
});

/* ---------- public config ---------- */
app.get("/api/config", (req, res) => res.json({
  stt: stt.enabled(),
  currency: CURRENCY,
  plans: Object.entries(PLANS).map(([id, p]) => ({ id, price: p.price, daily: p.daily })),
  payment: {
    methods: (process.env.PAYMENT_METHODS || "InstaPay,Vodafone Cash").split(",").map(s => s.trim()).filter(Boolean),
    instructions: process.env.PAYMENT_INSTRUCTIONS || ""
  }
}));

/* ---------- auth ---------- */
app.post("/api/auth/signup", authLimiter, (req, res) => {
  const username = String((req.body || {}).username || "").trim();
  const password = String((req.body || {}).password || "");
  const bad = badUsername(username);
  if (bad) return res.status(400).json({ error: bad });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) return res.status(409).json({ error: "Username already taken" });
  const r = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, bcrypt.hashSync(password, 10));
  const u = getUser(r.lastInsertRowid);
  res.json({ token: sign(u), user: publicUser(u) });
});

app.post("/api/auth/login", authLimiter, (req, res) => {
  const username = String((req.body || {}).username || "").trim();
  const password = String((req.body || {}).password || "");
  const u = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!u || !bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ error: "Wrong username or password" });
  res.json({ token: sign(u), user: publicUser(u) });
});

/* ---------- account ---------- */
app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.put("/api/me", auth, (req, res) => {
  const b = req.body || {}, u = req.user;
  let username = u.username, birth = u.birth, avatar = u.avatar, hash = u.password_hash;
  if (b.username !== undefined) {
    username = String(b.username).trim();
    const bad = username === u.username ? null : badUsername(username);
    if (bad) return res.status(400).json({ error: bad });
    const taken = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (taken && taken.id !== u.id) return res.status(409).json({ error: "Username already taken" });
  }
  if (b.password) {
    if (String(b.password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    hash = bcrypt.hashSync(String(b.password), 10);
  }
  if (b.birth !== undefined) {
    if (b.birth !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(b.birth)) return res.status(400).json({ error: "Invalid birth date" });
    birth = b.birth;
  }
  if (b.avatar !== undefined) {
    if (b.avatar !== "" && !(/^data:image\/(jpeg|png|webp);base64,/.test(b.avatar) && b.avatar.length < 300000)) return res.status(400).json({ error: "Invalid or too large picture" });
    avatar = b.avatar;
  }
  db.prepare("UPDATE users SET username=?, password_hash=?, birth=?, avatar=? WHERE id=?").run(username, hash, birth, avatar, u.id);
  res.json({ user: publicUser(getUser(u.id)) });
});

// Export everything we hold about the user (never includes tokens or the password hash).
app.get("/api/me/export", auth, (req, res) => {
  const id = req.user.id, one = (sql, ...a) => db.prepare(sql).all(...a);
  const chats = one("SELECT id, title, created_at FROM chats WHERE user_id = ?", id).map(c => ({ ...c, messages: one("SELECT role, type, text, files, created_at FROM messages WHERE chat_id = ?", c.id) }));
  res.setHeader("Content-Disposition", "attachment; filename=geno-export.json");
  res.json({ user: publicUser(req.user), brand: brandStore.get(id), memory: memory.list(id), chats,
    marketing: { plan: marketing.state(id).plan, tasks: marketing.state(id).tasks } });
});
// Permanently delete the account and everything linked to it (chats, files, brand, plan, channel tokens).
app.delete("/api/me", auth, authLimiter, (req, res) => {
  const u = req.user, pw = String((req.body || {}).password || "");
  if (u.password_hash === "!" || !bcrypt.compareSync(pw, u.password_hash)) return res.status(403).json({ error: "Wrong password" });
  const rows = db.prepare("SELECT m.files, m.audio FROM messages m JOIN chats c ON c.id = m.chat_id WHERE c.user_id = ?").all(u.id);
  for (const r of rows) {
    const names = [r.audio, ...JSON.parse(r.files || "[]").map(f => String(f.url || "").replace(/^\/uploads\//, ""))].filter(Boolean);
    names.forEach(n => fs.unlink(path.join(UPLOADS, path.basename(n)), () => {}));
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(u.id); // ON DELETE CASCADE removes the rest
  res.json({ ok: true });
});

/* ---------- personal memory ---------- */
const memErr = (res, e) => res.status(e.status || 400).json({ error: e.message });
app.get("/api/memory", auth, (req, res) => res.json({ notes: memory.list(req.user.id) }));
app.post("/api/memory", auth, (req, res) => { try { res.json({ note: memory.add(req.user.id, (req.body || {}).title, (req.body || {}).text) }); } catch (e) { memErr(res, e); } });
app.delete("/api/memory/:id", auth, (req, res) => { memory.remove(req.user.id, req.params.id); res.json({ ok: true }); });

/* ---------- brand profile (used by the marketing modes) ---------- */
app.get("/api/brand", auth, (req, res) => res.json({ brand: brandStore.get(req.user.id) }));
app.put("/api/brand", auth, (req, res) => res.json({ brand: brandStore.set(req.user.id, req.body) }));

// After the brand profile is saved: Geno starts working on the brand (analysis, ranked opportunities, 30-day plan and an execution menu).
app.post("/api/brand/kickoff", auth, chatLimiter, async (req, res) => {
  const b = brandStore.get(req.user.id);
  if (!b.name) return res.status(400).json({ error: "Save your brand name first" });
  const ar = req.body && req.body.lang === "ar";
  const text = ar ? `ابدأ شغل التسويق على البراند: ${b.name}` : `Start the marketing work for my brand: ${b.name}`;
  try {
    const r = await converse({ user: req.user, text, lang: ar ? "ar" : "en", mode: "mk_kickoff", dialect: DIALECTS.includes((req.body || {}).dialect) ? req.body.dialect : "auto", persona: "serious" });
    res.json({ chatId: r.chat.id, title: r.chat.title, user: r.user, bot: r.bot, usage: usage(getUser(req.user.id)) });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "Geno could not reply right now. Please try again." });
  }
});

/* ---------- plans & manual payments (InstaPay / Vodafone Cash / ...) ---------- */
app.post("/api/payments", auth, authLimiter, (req, res) => {
  const { plan, method, reference } = req.body || {};
  if (!["plus", "pro"].includes(plan)) return res.status(400).json({ error: "Unknown plan" });
  const ref = String(reference || "").trim();
  if (ref.length < 3 || ref.length > 80) return res.status(400).json({ error: "Enter the payment reference or transaction number" });
  if (db.prepare("SELECT 1 FROM payments WHERE reference = ?").get(ref)) return res.status(409).json({ error: "This reference was already submitted" });
  db.prepare("INSERT INTO payments (user_id, plan, method, reference) VALUES (?,?,?,?)").run(req.user.id, plan, String(method || "").slice(0, 40), ref);
  res.json({ ok: true });
});
app.get("/api/payments", auth, (req, res) =>
  res.json({ payments: db.prepare("SELECT id, plan, method, reference, status, created_at FROM payments WHERE user_id = ? ORDER BY id DESC").all(req.user.id) }));

app.get("/api/admin/payments", adminOnly, (req, res) =>
  res.json({ payments: db.prepare("SELECT p.id, u.username, p.plan, p.method, p.reference, p.status, p.created_at FROM payments p JOIN users u ON u.id = p.user_id WHERE p.status = ? ORDER BY p.id").all(req.query.status || "pending") }));
app.post("/api/admin/payments/:id/:action", adminOnly, (req, res) => {
  const p = db.prepare("SELECT * FROM payments WHERE id = ? AND status = 'pending'").get(req.params.id);
  if (!p) return res.status(404).json({ error: "No pending payment with this id" });
  if (req.params.action === "approve") {
    const until = new Date(Date.now() + 30 * 86400000).toISOString();
    db.transaction(() => {
      db.prepare("UPDATE payments SET status = 'approved' WHERE id = ?").run(p.id);
      db.prepare("UPDATE users SET plan = ?, plan_until = ? WHERE id = ?").run(p.plan, until, p.user_id);
    })();
  } else if (req.params.action === "reject") db.prepare("UPDATE payments SET status = 'rejected' WHERE id = ?").run(p.id);
  else return res.status(400).json({ error: "Use approve or reject" });
  res.json({ ok: true });
});

/* ---------- speech-to-text (optional) ---------- */
app.post("/api/transcribe", auth, chatLimiter, upload.single("audio"), async (req, res) => {
  const f = req.file;
  try {
    if (!stt.enabled()) return res.status(501).json({ error: "Server speech-to-text is not enabled" });
    if (!f) return res.status(400).json({ error: "No audio" });
    const lang = ["ar", "en"].includes(req.body.lang) ? req.body.lang : undefined;
    res.json({ text: await stt.transcribe(fs.readFileSync(f.path), "voice.webm", lang) });
  } catch (e) { console.error(e.message); res.status(502).json({ error: "Could not transcribe the audio" }); }
  finally { if (f) fs.unlink(f.path, () => {}); }
});

/* ---------- chats ---------- */
app.get("/api/chats", auth, (req, res) =>
  res.json({ chats: db.prepare("SELECT id, title FROM chats WHERE user_id = ? ORDER BY id DESC").all(req.user.id) }));

app.get("/api/chats/:id", auth, (req, res) => {
  const chat = db.prepare("SELECT id, title FROM chats WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({ chat, messages: db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY id").all(chat.id).map(msgOut) });
});
app.delete("/api/chats/:id", auth, (req, res) => {
  db.prepare("DELETE FROM chats WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.json({ ok: true });
});
app.delete("/api/chats", auth, (req, res) => {
  db.prepare("DELETE FROM chats WHERE user_id = ?").run(req.user.id);
  res.json({ ok: true });
});

app.post("/api/chat", auth, chatLimiter, upload.fields([{ name: "files", maxCount: 5 }, { name: "audio", maxCount: 1 }]), async (req, res) => {
  const files = ((req.files || {}).files || []).map(f => ({ name: f.originalname.slice(0, 120), mime: f.mimetype, size: f.size, path: f.path, url: "/uploads/" + f.filename }));
  const audio = ((req.files || {}).audio || [])[0];
  try {
    let bars = null;
    try { bars = req.body.bars ? JSON.parse(req.body.bars) : null; } catch (e) {}
    const r = await converse({
      user: req.user, chatId: req.body.chatId, text: req.body.text, type: req.body.type === "voice" ? "voice" : "text",
      files, audioFile: audio ? audio.filename : null, bars, lang: ["ar", "en"].includes(req.body.lang) ? req.body.lang : undefined,
      mode: MODES.includes(req.body.mode) ? req.body.mode : "general", dialect: DIALECTS.includes(req.body.dialect) ? req.body.dialect : "auto",
      persona: PERSONAS.includes(req.body.persona) ? req.body.persona : "funny"
    });
    res.json({ chatId: r.chat.id, title: r.chat.title, user: r.user, bot: r.bot, usage: usage(getUser(req.user.id)) });
  } catch (e) {
    if (e instanceof HttpError) {
      [...files, ...(audio ? [{ path: audio.path }] : [])].forEach(f => fs.unlink(f.path, () => {}));
      return res.status(e.status).json({ error: e.message });
    }
    console.error(e);
    res.status(500).json({ error: "Geno could not reply right now. Please try again." });
  }
});

/* ---------- Marketing execution (plan, publish, schedule) ---------- */
marketing.routes(app, auth, chatLimiter);
marketing.startScheduler();

/* ---------- WhatsApp ---------- */
require("./whatsapp")(app);
require("./legal")(app);
require("./backup").start();

/* ---------- static ---------- */
app.use("/uploads", express.static(UPLOADS, {
  setHeaders: r => { r.setHeader("X-Content-Type-Options", "nosniff"); r.setHeader("Content-Security-Policy", "sandbox; default-src 'none'"); }
}));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request body" });
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Request too large" });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => console.log(`Geno running on http://localhost:${PORT}` + (process.env.ANTHROPIC_API_KEY ? "" : "  (demo mode: no ANTHROPIC_API_KEY)")));
