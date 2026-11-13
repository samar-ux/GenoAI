const db = require("./db");
const FIELDS = ["name", "industry", "audience", "tone", "usp", "competitors", "goals", "notes"];
const LABELS = { name: "Brand name", industry: "Industry", audience: "Target audience", tone: "Tone of voice", usp: "Unique selling points", competitors: "Competitors", goals: "Goals and budget", notes: "Other notes" };

function get(userId) {
  const r = db.prepare("SELECT data FROM brand WHERE user_id = ?").get(userId);
  const d = r ? JSON.parse(r.data) : {};
  return { ...Object.fromEntries(FIELDS.map(f => [f, String(d[f] || "")])), auto: d.auto !== false };
}
function set(userId, input) {
  const d = Object.fromEntries(FIELDS.map(f => [f, String((input || {})[f] || "").trim().slice(0, 1000)]));
  d.auto = (input || {}).auto !== false; // use the profile automatically in every chat (default on)
  db.prepare("INSERT INTO brand (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data").run(userId, JSON.stringify(d));
  return d;
}
function format(b) {
  const lines = FIELDS.filter(f => b[f]).map(f => `${LABELS[f]}: ${b[f]}`);
  return lines.length ? lines.join("\n") : "";
}
module.exports = { get, set, format };
