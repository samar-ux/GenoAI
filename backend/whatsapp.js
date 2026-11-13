// WhatsApp Cloud API bridge: each phone number becomes its own Geno account (username wa_<number>).
// Needs WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET (see README).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const { converse, HttpError, UPLOADS, MODES, PERSONAS } = require("./core");
const stt = require("./stt");
const memory = require("./memory");

const G = "https://graph.facebook.com/v21.0";
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "audio/ogg": ".ogg" };
const modes = new Map(); // phone -> mode (kept in memory only)
const personas = new Map(); // phone -> persona (kept in memory only)
const auth = () => ({ Authorization: "Bearer " + process.env.WHATSAPP_TOKEN });

function waUser(phone) {
  const username = "wa_" + phone.replace(/\D/g, "");
  let u = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!u) {
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, '!')").run(username); // '!' can never match a password
    u = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  }
  return u;
}
async function send(to, text) {
  const r = await fetch(`${G}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: String(text).slice(0, 4000) } })
  });
  if (!r.ok) throw new Error("send failed " + r.status);
}
async function media(id) {
  const meta = await (await fetch(`${G}/${id}`, { headers: auth() })).json();
  const buf = Buffer.from(await (await fetch(meta.url, { headers: auth() })).arrayBuffer());
  const mime = (meta.mime_type || "").split(";")[0];
  const filename = crypto.randomUUID() + (EXT[mime] || "");
  const p = path.join(UPLOADS, filename);
  fs.writeFileSync(p, buf);
  return { name: filename, mime, size: buf.length, path: p, url: "/uploads/" + filename, buf };
}

async function handleMessage(m) {
  const from = m.from, user = waUser(from);
  let text = "", files = [], type = "text";
  if (m.type === "text") {
    text = m.text.body || "";
    const mode = text.match(/^\/mode\s+(\w+)/i);
    if (mode) {
      if (!MODES.includes(mode[1].toLowerCase())) return send(from, "Modes: " + MODES.join(", "));
      modes.set(from, mode[1].toLowerCase()); return send(from, "Mode set to " + mode[1].toLowerCase());
    }
    const persona = text.match(/^\/persona\s+(\w+)/i);
    if (persona) {
      if (!PERSONAS.includes(persona[1].toLowerCase())) return send(from, "Personas: " + PERSONAS.join(", "));
      personas.set(from, persona[1].toLowerCase()); return send(from, "Persona set to " + persona[1].toLowerCase());
    }
    const note = text.match(/^\/note\s+([\s\S]+)/i);
    if (note) { memory.add(user.id, "WhatsApp note", note[1]); return send(from, "Saved to your memory."); }
  } else if (m.type === "image") {
    const f = await media(m.image.id); files = [f]; text = m.image.caption || "";
  } else if (m.type === "audio") {
    if (!stt.enabled()) return send(from, "Voice messages need speech-to-text enabled on the server. Please type your message.");
    const f = await media(m.audio.id);
    text = await stt.transcribe(f.buf, "voice.ogg"); type = "voice";
    if (!text) return send(from, "I could not understand the audio.");
  } else return send(from, "I can read text, images and voice messages.");

  const last = db.prepare("SELECT id FROM chats WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(user.id);
  try {
    const r = await converse({ user, chatId: last && last.id, text, type, files, mode: modes.get(from) || "general", dialect: "auto", persona: personas.get(from) || "funny" });
    await send(from, r.bot.text);
  } catch (e) {
    if (e instanceof HttpError) return send(from, e.message);
    throw e;
  }
}

module.exports = function mount(app) {
  app.get("/webhook/whatsapp", (req, res) => {
    const ok = process.env.WHATSAPP_VERIFY_TOKEN && req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN;
    ok ? res.status(200).send(req.query["hub.challenge"]) : res.sendStatus(403);
  });
  app.post("/webhook/whatsapp", (req, res) => {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret || !process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_ID) return res.sendStatus(503);
    const sig = req.get("x-hub-signature-256") || "";
    const exp = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("hex");
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return res.sendStatus(401);
    res.sendStatus(200); // acknowledge fast, answer afterwards
    (async () => {
      for (const e of req.body.entry || []) for (const c of e.changes || []) for (const m of (c.value && c.value.messages) || []) {
        try { await handleMessage(m); } catch (err) { console.error("[whatsapp]", err.message); }
      }
    })();
  });
};
