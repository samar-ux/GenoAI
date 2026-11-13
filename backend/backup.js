// Daily SQLite backup (VACUUM INTO is safe while the app is running). Keeps the last 7 copies in DATA_DIR/backups.
const fs = require("fs");
const path = require("path");
const db = require("./db");

const dir = path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "backups");
function run() {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `geno-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(file)) db.prepare("VACUUM INTO ?").run(file);
    fs.readdirSync(dir).filter(f => /^geno-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -7).forEach(f => fs.unlinkSync(path.join(dir, f)));
  } catch (e) { console.error("[backup]", e.message); }
}
function start() { run(); setInterval(run, 6 * 60 * 60 * 1000).unref(); }
module.exports = { start, run };
