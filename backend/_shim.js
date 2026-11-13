// Test helper: replaces better-sqlite3 with Node's built-in node:sqlite (Node 22.5+) and the Anthropic SDK with a stub,
// so the tests run without installing anything and without network access.
const Module = require("module"), { DatabaseSync } = require("node:sqlite");
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === "better-sqlite3") return class { constructor() { this.d = new DatabaseSync(":memory:"); } pragma() {} exec(s) { this.d.exec(s); } prepare(s) { return this.d.prepare(s); } };
  if (req === "@anthropic-ai/sdk") return class { constructor() {} get messages() { return { create: async () => ({ content: [{ type: "text", text: "{}" }] }) }; } };
  return orig.call(this, req, ...a);
};
process.env.JWT_SECRET = "x".repeat(40);
delete process.env.ANTHROPIC_API_KEY;
