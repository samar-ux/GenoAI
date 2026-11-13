require("./_shim");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db"), brand = require("../brand"), mk = require("../marketing");

const mockFetch = (fn, calls = []) => { global.fetch = async (url, o) => { calls.push([String(url), o && o.body ? decodeURIComponent(String(o.body)) : ""]); const j = await fn(String(url)); return { ok: !j.__fail, status: j.__fail ? 400 : 200, json: async () => j }; }; return calls; };
db.prepare("INSERT INTO users (username,password_hash) VALUES ('u','x')").run();
brand.set(1, { name: "Zaytoun", industry: "Olive oil", audience: "Home cooks", usp: "Cold-pressed in Siwa", goals: "200 orders/month" });
const task = ch => mk.state(1).tasks.find(t => t.channel === ch);

test("builds a plan from the brand profile (demo mode)", async () => {
  const st = await mk.generatePlan(1, { lang: "en" });
  assert.ok(st.tasks.length >= 5); assert.match(st.plan.goal, /200 orders/);
});
test("refuses unconnected channels, bad input and unfinished copy", async () => {
  let r = await mk.runTask(1, task("facebook_post")); assert.equal(r.status, "failed"); assert.match(r.result.error, /Connect this channel/);
  assert.throws(() => mk.saveChannels(1, { fb_page_id: "abc" }), /Invalid/);
  const st = mk.saveChannels(1, { fb_page_id: "1234567890", fb_token: "T".repeat(40), tg_token: "123456:" + "a".repeat(35), tg_chat: "@zaytoun_ch", ad_account: "act_555555", ad_page_id: "1234567890", ad_token: "A".repeat(40) });
  assert.ok(st.ready.facebook_post && st.ready.telegram_post && st.ready.meta_ad); assert.ok(!JSON.stringify(st).includes("TTTT"));
  r = await mk.runTask(1, task("facebook_post")); assert.match(r.result.error, /website link/); // [website link] placeholder not filled
});
test("publishes to Facebook, Telegram and creates a PAUSED Meta ad", async () => {
  mk.saveChannels(1, { link: "https://zaytoun.example" });
  const calls = mockFetch(u => /telegram/.test(u) ? { ok: true, result: { message_id: 7 } } : { id: "ID" + calls.length });
  let r = await mk.runTask(1, task("facebook_post")); assert.equal(r.status, "done"); assert.ok(calls[0][1].includes("zaytoun.example")); assert.ok(r.result.ids.post);
  r = await mk.runTask(1, task("telegram_post")); assert.equal(r.status, "done"); assert.match(r.result.url, /t\.me\/zaytoun_ch\/7/);
  calls.length = 0; r = await mk.runTask(1, task("meta_ad")); assert.equal(r.status, "done");
  assert.deepEqual(calls.map(c => c[0].split("/").pop()), ["campaigns", "adsets", "adcreatives", "ads"]);
  assert.ok(calls.filter(c => !/adcreatives/.test(c[0])).every(c => c[1].includes("PAUSED"))); assert.ok(r.result.ids.ad);
});
test("never runs a finished task twice and enforces the budget cap", async () => {
  await assert.rejects(() => mk.runTask(1, task("meta_ad")), /already running or finished/);
  await assert.rejects(() => mk.RUNNERS.meta_ad({ text: "x", link: "https://a.b", daily_budget: 99999 }, mk.getCreds(1)), /between 1 and/);
});
test("scheduler runs due approved tasks", async () => {
  mockFetch(() => ({ ok: true, result: { message_id: 1 } }));
  const id = db.prepare("INSERT INTO mk_tasks (user_id,title,channel,content,status,run_at) VALUES (1,'s','telegram_post',?, 'scheduled', ?)").run(JSON.stringify({ text: "hello" }), new Date(Date.now() - 1000).toISOString()).lastInsertRowid;
  await mk.tick(); assert.equal(db.prepare("SELECT status FROM mk_tasks WHERE id=?").get(id).status, "done");
});
test("API errors are readable and never leak tokens; expired token is explained", async () => {
  const id = db.prepare("INSERT INTO mk_tasks (user_id,title,channel,content) VALUES (1,'x','facebook_post',?)").run(JSON.stringify({ text: "hi" })).lastInsertRowid, get = () => mk.state(1).tasks.find(t => t.id === id);
  mockFetch(() => ({ __fail: true, error: { message: "Bad token " + "T".repeat(40), code: 100 } }));
  let r = await mk.runTask(1, get()); assert.equal(r.status, "failed"); assert.ok(!r.result.error.includes("TTTT"));
  mockFetch(() => ({ __fail: true, error: { message: "x", code: 190 } }));
  r = await mk.runTask(1, get()); assert.match(r.result.error, /expired or was revoked/);
});
test("reads results from Meta and totals them", async () => {
  mockFetch(u => /insights/.test(u) ? { data: [{ impressions: "1000", reach: "800", clicks: "25", ctr: "2.5", cpc: "0.4", spend: "10" }] } : { reactions: { summary: { total_count: 12 } }, comments: { summary: { total_count: 3 } }, shares: { count: 2 } });
  const r = await mk.results(1);
  assert.equal(r.totals.clicks, 25); assert.equal(r.totals.ctr, 2.5); assert.equal(r.totals.spend, 10);
  assert.equal(r.items.find(i => i.channel === "facebook_post").metrics.reactions, 12);
  const v = await mk.review(1, { lang: "en" }); assert.match(v.text, /25 clicks/); // demo-mode review is computed from real numbers
});
test("sanitizes whatever the model returns", () => {
  const p = mk.clean(mk.parseJSON('```json\n{"goal":"g","tasks":[{"title":"t","channel":"evil","day":99,"content":{"text":"x"}},{"title":"e","channel":"meta_ad","content":{"text":"y","daily_budget":100000,"countries":["eg","EG"]}}]}\n```'));
  assert.equal(p.tasks[0].channel, "manual"); assert.equal(p.tasks[0].day, 30); assert.equal(p.tasks[1].content.daily_budget, 50); assert.deepEqual(p.tasks[1].content.countries, ["EG"]);
});
