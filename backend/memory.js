const db = require("./db");

const MAX_TOTAL = 200000, MAX_NOTE = 50000;
const STOP = new Set(["the", "a", "an", "is", "are", "of", "to", "in", "and", "or", "for", "on", "with", "what", "من", "في", "على", "الى", "عن", "ما", "ماذا", "هو", "هي", "ان", "او", "و"]);

function normalize(s) {
  return String(s).toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}
function tokens(s) {
  return normalize(s).split(/\s+/).map(w => (w.length > 4 && w.startsWith("ال") ? w.slice(2) : w)).filter(w => w.length >= 2 && !STOP.has(w));
}
function chunk(text, max = 700) {
  const out = []; let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    for (let p = para.trim(); p.length > 0;) {
      const piece = p.slice(0, max); p = p.slice(max);
      if (cur && (cur + "\n" + piece).length > max) { out.push(cur); cur = piece; } else cur = cur ? cur + "\n" + piece : piece;
    }
  }
  if (cur) out.push(cur);
  return out;
}
function fail(status, msg) { const e = new Error(msg); e.status = status; return e; }

function add(userId, title, text) {
  text = String(text || "").trim();
  if (!text) throw fail(400, "Note is empty");
  if (text.length > MAX_NOTE) throw fail(413, "Note is too long (max 50,000 characters)");
  const total = db.prepare("SELECT COALESCE(SUM(LENGTH(text)),0) AS n FROM memory WHERE user_id = ?").get(userId).n;
  if (total + text.length > MAX_TOTAL) throw fail(413, "Memory is full. Delete some notes first.");
  title = String(title || "").trim().slice(0, 80) || text.slice(0, 40);
  const id = db.prepare("INSERT INTO memory (user_id, title, text) VALUES (?, ?, ?)").run(userId, title, text).lastInsertRowid;
  return { id, title, preview: text.slice(0, 200) };
}
const list = userId => db.prepare("SELECT id, title, SUBSTR(text,1,200) AS preview FROM memory WHERE user_id = ? ORDER BY id DESC").all(userId);
const remove = (userId, id) => db.prepare("DELETE FROM memory WHERE id = ? AND user_id = ?").run(id, userId);

// keyword search with IDF weighting over note chunks
function rank(rows, query, k = 4) {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const chunks = rows.flatMap(r => chunk(r.text).map(c => ({ title: r.title, text: c, set: new Set(tokens(c)) })));
  if (!chunks.length) return [];
  const idf = {};
  for (const w of q) idf[w] = Math.log(1 + chunks.length / (1 + chunks.filter(c => c.set.has(w)).length));
  return chunks.map(c => ({ ...c, score: q.reduce((s, w) => s + (c.set.has(w) ? idf[w] : 0), 0) }))
    .filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map(({ title, text }) => ({ title, text }));
}
const search = (userId, query, k) => rank(db.prepare("SELECT title, text FROM memory WHERE user_id = ?").all(userId), query, k);

module.exports = { add, list, remove, search, rank, normalize };
