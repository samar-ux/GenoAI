const path = require("path");
const fs = require("fs");
const db = require("./db");
const { generateReply } = require("./ai");
const memory = require("./memory");
const brandStore = require("./brand");
const analytics = require("./analytics");
const { effectivePlan, usage } = require("./plans");

const DATA = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOADS = path.join(DATA, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const MODES = ["general", "student", "business", "freelancer", "gov", "meeting", "tutor", "mk_strategy", "mk_content", "mk_media", "mk_analytics", "mk_video", "mk_seo", "mk_kickoff", "mk_exec"];
const DIALECTS = ["auto", "egyptian", "gulf", "levantine", "msa"];
const PERSONAS = ["serious", "funny", "roast"];

const msgOut = m => ({
  id: m.id, role: m.role, type: m.type, text: m.text,
  bars: m.bars ? JSON.parse(m.bars) : null,
  audio: m.audio ? "/uploads/" + m.audio : null,
  files: JSON.parse(m.files || "[]")
});

// One conversation turn: quota check, save user message, ask Claude (with the user's memory), save reply.
async function converse({ user, chatId, text, type = "text", files = [], audioFile = null, bars = null, lang, mode = "general", dialect = "auto", persona = "funny" }) {
  text = String(text || "").trim().slice(0, 8000);
  if (!text && !files.length) throw new HttpError(400, "Empty message");
  const us = usage(user);
  if (us.used >= us.limit) throw new HttpError(429, `Daily limit reached (${us.limit} messages on the ${effectivePlan(user)} plan). Upgrade to continue.`);

  let chat;
  if (chatId) {
    chat = db.prepare("SELECT id, title FROM chats WHERE id = ? AND user_id = ?").get(chatId, user.id);
    if (!chat) throw new HttpError(404, "Chat not found");
  } else {
    const title = (text || files[0].name).slice(0, 40);
    chat = { id: db.prepare("INSERT INTO chats (user_id, title) VALUES (?, ?)").run(user.id, title).lastInsertRowid, title };
  }

  const history = db.prepare("SELECT role, text, files FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 30").all(chat.id).reverse();
  const ins = db.prepare("INSERT INTO messages (chat_id, role, type, text, bars, files, audio) VALUES (?,?,?,?,?,?,?)");
  const userId = ins.run(chat.id, "user", type, text, bars ? JSON.stringify(bars.slice(0, 60).map(Number)) : null,
    JSON.stringify(files.map(({ name, mime, url }) => ({ name, mime, url }))), audioFile).lastInsertRowid;

  const botType = type === "voice" && mode !== "meeting" ? "voice" : "text"; // meeting notes are read, not spoken
  const mk = mode.startsWith("mk_"), bp = brandStore.get(user.id); // saved brand profile: used automatically unless switched off
  let dataSummary = null;
  if (mode === "mk_analytics") {
    for (const f of files) if (/csv|excel/.test(f.mime) || /\.(csv|tsv)$/i.test(f.name)) {
      try { dataSummary = analytics.summarize(fs.readFileSync(f.path, "utf8").slice(0, 2000000)); } catch (e) {}
      if (dataSummary) break;
    }
  }
  const reply = await generateReply(history, { text, files, lang, dialect, mode, voice: botType === "voice", memories: memory.search(user.id, text), persona, brand: (mk || bp.auto) ? brandStore.format(bp) : "", dataSummary });
  const botBars = botType === "voice" ? JSON.stringify(Array.from({ length: 36 }, () => +(0.2 + Math.random() * 0.8).toFixed(2))) : null;
  const botId = ins.run(chat.id, "assistant", botType, reply, botBars, "[]", null).lastInsertRowid;

  const get = db.prepare("SELECT * FROM messages WHERE id = ?");
  return { chat, user: msgOut(get.get(userId)), bot: msgOut(get.get(botId)) };
}

module.exports = { converse, HttpError, UPLOADS, MODES, DIALECTS, PERSONAS, msgOut };
