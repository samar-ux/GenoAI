require("./_shim");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "geno-"));
const backup = require("../backup");

test("backup writes a dated copy and keeps at most 7", () => {
  const dir = path.join(process.env.DATA_DIR, "backups"); fs.mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= 9; i++) fs.writeFileSync(path.join(dir, `geno-2020-01-0${i}.db`), "x");
  backup.run();
  const files = fs.readdirSync(dir).sort(); assert.equal(files.length, 7); assert.ok(files.some(f => f.startsWith("geno-" + new Date().getFullYear())));
});
test("legal pages render with company details", () => {
  process.env.COMPANY_NAME = "Acme <b>"; process.env.CONTACT_EMAIL = "hi@acme.test";
  const routes = {}; require("../legal")({ get: (p, h) => routes[p] = h });
  for (const p of ["/privacy", "/terms", "/data-deletion"]) { let html; routes[p]({}, { type: () => ({ send: h => html = h }) }); assert.match(html, /hi@acme\.test/); assert.ok(!html.includes("Acme <b>") && html.includes("Acme &lt;b&gt;") || p === "/data-deletion"); }
});
