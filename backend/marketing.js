// Marketing execution engine: turns the saved brand profile into a concrete plan of tasks and really runs them
// (Facebook Page posts, Telegram channel posts, Meta ads created PAUSED) after the user approves each one.
const crypto = require("crypto");
const db = require("./db");
const brandStore = require("./brand");
const ai = require("./ai");

const G = "https://graph.facebook.com/v21.0";
const CHANNELS = ["facebook_post", "telegram_post", "meta_ad", "manual"];
const MAX_BUDGET = Number(process.env.MK_MAX_DAILY_BUDGET) || 50; // safety cap for one ad's daily budget (account currency)
const PH = /\[[^\]\n]{1,80}\]/; // [placeholder] = a fact the AI did not know: such a task is never run

/* ---------- stored channel credentials (AES-256-GCM, key derived from JWT_SECRET) ---------- */
const KEY = crypto.createHash("sha256").update("geno-mk:" + (process.env.JWT_SECRET || "dev-secret")).digest();
function enc(obj) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const b = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), b].map(x => x.toString("base64")).join(".");
}
function dec(s) {
  if (!s) return {};
  try {
    const [iv, tag, b] = s.split(".").map(x => Buffer.from(x, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv); d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(b), d.final()]).toString("utf8"));
  } catch (e) { return {}; }
}
const getCreds = uid => { const r = db.prepare("SELECT data FROM mk_channels WHERE user_id = ?").get(uid); return r ? dec(r.data) : {}; };
const setCreds = (uid, o) => db.prepare("INSERT INTO mk_channels (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data").run(uid, enc(o));

const GROUPS = { fb: ["fb_page_id", "fb_token"], tg: ["tg_token", "tg_chat"], ad: ["ad_account", "ad_page_id", "ad_token"] };
const SECRET = new Set(["fb_token", "tg_token", "ad_token"]);
const RULES = {
  fb_page_id: /^\d{5,25}$/, tg_chat: /^(@\w{4,64}|-?\d{5,20})$/, ad_account: /^(act_)?\d{5,25}$/, ad_page_id: /^\d{5,25}$/,
  fb_token: /^\S{20,600}$/, tg_token: /^\d{5,15}:[\w-]{20,60}$/, ad_token: /^\S{20,600}$/, link: /^https?:\/\/\S{3,300}$/
};
function saveChannels(uid, input) {
  const cur = getCreds(uid), next = { ...cur };
  for (const k of [...Object.values(GROUPS).flat(), "link"]) {
    const v = String((input || {})[k] ?? "").trim();
    if (!v) continue; // empty = keep what is stored
    if (!RULES[k].test(v)) throw Object.assign(new Error("Invalid value for " + k), { status: 400 });
    next[k] = v;
  }
  setCreds(uid, next);
  return channelStatus(uid);
}
function clearGroup(uid, g) {
  if (!GROUPS[g]) throw Object.assign(new Error("Unknown channel"), { status: 400 });
  const cur = getCreds(uid); GROUPS[g].forEach(k => delete cur[k]); setCreds(uid, cur);
  return channelStatus(uid);
}
const ready = k => ({
  facebook_post: !!(k.fb_page_id && k.fb_token), telegram_post: !!(k.tg_token && k.tg_chat),
  meta_ad: !!(k.ad_account && k.ad_token && k.ad_page_id), manual: false
});
function channelStatus(uid) { // never returns tokens
  const k = getCreds(uid);
  const shown = {}; for (const f of Object.values(GROUPS).flat().concat("link")) if (!SECRET.has(f) && k[f]) shown[f] = k[f];
  return { ready: ready(k), values: shown, maxBudget: MAX_BUDGET };
}

/* ---------- connectors ---------- */
async function http(url, opt) {
  const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(20000) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok || j.error || j.ok === false) {
    if (j.error && (j.error.code === 190 || r.status === 401)) throw new Error("The access token expired or was revoked. Create a new token and save it in Channels.");
    throw new Error(String((j.error && (j.error.message || j.error)) || j.description || "HTTP " + r.status));
  }
  return j;
}
const form = o => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
const gpost = (path, token, o) => http(`${G}/${path}`, { method: "POST", body: form({ ...o, access_token: token }) });

const RUNNERS = {
  async facebook_post(c, k) {
    const j = await gpost(`${k.fb_page_id}/feed`, k.fb_token, { message: c.text, ...(c.link ? { link: c.link } : {}) });
    return { text: "Published on your Facebook Page", url: "https://facebook.com/" + j.id, ids: { post: j.id } };
  },
  async telegram_post(c, k) {
    const j = await http(`https://api.telegram.org/bot${k.tg_token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: k.tg_chat, text: (c.text + (c.link ? "\n" + c.link : "")).slice(0, 4096) })
    });
    return { text: "Published on Telegram", ids: { tg: String(j.result.message_id) }, url: /^@/.test(k.tg_chat) ? `https://t.me/${k.tg_chat.slice(1)}/${j.result.message_id}` : "" };
  },
  async meta_ad(c, k) { // everything is created PAUSED: the owner reviews and switches it on in Ads Manager
    const budget = Number(c.daily_budget) || 5;
    if (budget < 1 || budget > MAX_BUDGET) throw new Error(`Daily budget must be between 1 and ${MAX_BUDGET} (set MK_MAX_DAILY_BUDGET to change the cap)`);
    if (!c.link) throw new Error("An ad needs a link");
    const act = "act_" + String(k.ad_account).replace(/^act_/, ""), name = String(c.headline || c.text).slice(0, 60);
    const countries = (Array.isArray(c.countries) && c.countries.length ? c.countries : ["EG"]).filter(x => /^[A-Z]{2}$/.test(x)).slice(0, 5);
    const camp = await gpost(`${act}/campaigns`, k.ad_token, { name: "Geno - " + name, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: [] });
    const set = await gpost(`${act}/adsets`, k.ad_token, {
      name: "Geno set - " + name, campaign_id: camp.id, daily_budget: Math.round(budget * 100), billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP", targeting: { geo_locations: { countries }, age_min: 18 }, status: "PAUSED"
    });
    const cr = await gpost(`${act}/adcreatives`, k.ad_token, {
      name: "Geno creative - " + name,
      object_story_spec: { page_id: k.ad_page_id, link_data: { message: c.text, link: c.link, name: c.headline || "", call_to_action: { type: "LEARN_MORE", value: { link: c.link } } } }
    });
    const ad = await gpost(`${act}/ads`, k.ad_token, { name: "Geno ad - " + name, adset_id: set.id, creative: { creative_id: cr.id }, status: "PAUSED" });
    return { text: `Created in PAUSED state (campaign ${camp.id}, ad ${ad.id}). Review it in Meta Ads Manager and switch it on when ready.`, ids: { campaign: camp.id, adset: set.id, ad: ad.id }, url: "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=" + act.slice(4) };
  }
};

function effective(task, k) { // fill the default website link, refuse unfinished copy
  const c = { ...task.content };
  const needsLink = c.link && PH.test(c.link);
  if (!c.link || needsLink) c.link = k.link || "";
  if (!String(c.text || "").trim()) throw new Error("This task has no text");
  if (PH.test([c.text, c.headline].join(" "))) throw new Error("Fill in the [placeholders] in the text first");
  if (needsLink && !c.link) throw new Error("Set your website link in Channels (or in the task) first");
  return c;
}
const scrub = (m, k) => Object.values(k).filter(v => typeof v === "string" && v.length > 8).reduce((s, v) => s.split(v).join("***"), String(m));

/* ---------- tasks ---------- */
const out = r => ({ id: r.id, title: r.title, channel: r.channel, content: JSON.parse(r.content), why: r.why, day: r.day, run_at: r.run_at, status: r.status, result: JSON.parse(r.result) });
const listTasks = uid => db.prepare("SELECT * FROM mk_tasks WHERE user_id = ? ORDER BY day, id").all(uid).map(out);
const getTask = (uid, id) => { const r = db.prepare("SELECT * FROM mk_tasks WHERE id = ? AND user_id = ?").get(id, uid); return r ? out(r) : null; };
const setResult = (id, status, result) => db.prepare("UPDATE mk_tasks SET status = ?, result = ? WHERE id = ?").run(status, JSON.stringify(result), id);

async function runTask(uid, task) {
  const claimed = db.prepare("UPDATE mk_tasks SET status = 'running' WHERE id = ? AND user_id = ? AND status IN ('draft','scheduled','failed')").run(task.id, uid);
  if (!claimed.changes) throw Object.assign(new Error("This task is already running or finished"), { status: 409 });
  const k = getCreds(uid);
  try {
    if (task.channel === "manual") throw new Error("Manual tasks are done by you: copy the text and mark it done");
    if (!ready(k)[task.channel]) throw new Error("Connect this channel first (Channels section)");
    const r = await RUNNERS[task.channel](effective(task, k), k);
    setResult(task.id, "done", { ...r, at: new Date().toISOString() });
  } catch (e) {
    setResult(task.id, "failed", { error: scrub(e.message, k).slice(0, 400), at: new Date().toISOString() });
  }
  return getTask(uid, task.id);
}
let ticking = false;
async function tick() {
  if (ticking) return; ticking = true;
  try {
    const due = db.prepare("SELECT id, user_id FROM mk_tasks WHERE status = 'scheduled' AND run_at <= ? ORDER BY run_at LIMIT 20").all(new Date().toISOString());
    for (const d of due) { const t = getTask(d.user_id, d.id); if (t) await runTask(d.user_id, t); }
  } catch (e) { console.error("mk scheduler", e.message); } finally { ticking = false; }
}
function startScheduler() {
  db.prepare("UPDATE mk_tasks SET status = 'failed', result = ? WHERE status = 'running'").run(JSON.stringify({ error: "Interrupted by a server restart. Check the channel, then retry." }));
  setInterval(tick, 60 * 1000).unref();
}

/* ---------- plan generation ---------- */
const PLAN_PROMPT = `You are a performance marketer building an executable plan for the brand below. Return ONLY one JSON object, no markdown, no commentary:
{"goal": string, "kpis": [{"name": string, "target": string, "measure": string}], "tasks": [{"title": string, "channel": string, "day": number, "why": string, "content": object}]}
- goal: one measurable sentence in the user's language, based on the brand goals (state your assumption if the goal or budget is missing).
- kpis: 3 to 5, each with a realistic starting target and exactly where to measure it.
- tasks: 10 to 14, ordered by day (1 to 30). channel is one of:
  facebook_post (content {"text","link"}), telegram_post (content {"text","link"}),
  meta_ad (content {"headline","text","link","daily_budget": small test budget as a number,"countries": ["ISO2"]}),
  manual (content {"text","where"}): for work the app cannot publish itself (instagram, tiktok, google_ads, seo, whatsapp, email, other). text = the complete ready-to-use material.
- Include A/B hook tests, and review tasks on day 7, 14 and 30 (manual, where "other") saying which numbers to check and which decision to take.
- Use meta_ad only if the brand profile mentions a budget; otherwise use manual with where "google_ads" or "instagram".
- Write the full final copy in the brand tone, in the user's language and dialect. Never invent facts, prices, statistics, awards or testimonials: write [brackets] for anything unknown, and use "[website link]" as the link unless the profile has one. Never promise results.`;

function parseJSON(t) {
  t = String(t || "").replace(/```json|```/g, ""); const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
const s = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
function clean(plan) {
  const tasks = (Array.isArray(plan.tasks) ? plan.tasks : []).slice(0, 16).map(t => {
    const c = t.content || {}, channel = CHANNELS.includes(t.channel) ? t.channel : "manual";
    const content = { text: s(c.text, 4000), ...(c.link ? { link: s(c.link, 300) } : {}) };
    if (channel === "meta_ad") Object.assign(content, { headline: s(c.headline, 80), daily_budget: Math.min(Math.max(Number(c.daily_budget) || 5, 1), MAX_BUDGET), countries: (Array.isArray(c.countries) ? c.countries : ["EG"]).filter(x => /^[A-Z]{2}$/.test(x)).slice(0, 5) });
    if (channel === "manual") content.where = s(c.where || "other", 30);
    return { title: s(t.title, 120) || "Task", channel, content, why: s(t.why, 400), day: Math.min(Math.max(parseInt(t.day) || 1, 1), 30) };
  }).filter(t => t.content.text);
  return { goal: s(plan.goal, 400), kpis: (Array.isArray(plan.kpis) ? plan.kpis : []).slice(0, 6).map(x => ({ name: s(x.name, 80), target: s(x.target, 120), measure: s(x.measure, 160) })), tasks };
}
function fallbackPlan(b, ar) { // demo mode (no API key): a simple plan built from the profile, no invented facts
  const n = b.name, u = b.usp || (ar ? "[ميزة البراند]" : "[your key benefit]"), a = b.audience || (ar ? "[الجمهور]" : "[audience]");
  const T = (title, channel, day, why, content) => ({ title, channel, day, why, content });
  return ar ? {
    goal: b.goals || `زيادة الوعي والطلبات لـ ${n} خلال 30 يوم [حدد الرقم المستهدف]`,
    kpis: [{ name: "الوصول", target: "[حدد]", measure: "Meta Insights" }, { name: "نسبة النقر CTR", target: "1% أو أكثر", measure: "Ads Manager" }, { name: "تكلفة الطلب CPA", target: "[حدد]", measure: "Ads Manager + مبيعاتك" }],
    tasks: [
      T("منشور تعريفي بالبراند", "facebook_post", 1, "تثبيت الرسالة الأساسية", { text: `${n} - ${u}\nمصمم لـ ${a}.\nاعرف أكثر 👇`, link: "[website link]" }),
      T("منشور القناة", "telegram_post", 2, "بناء جمهور مباشر", { text: `أهلاً بك في ${n}. هنا ستجد ${u}.`, link: "[website link]" }),
      T("إعلان اختبار - هوك 1", "meta_ad", 3, "اختبار أول رسالة", { headline: n, text: `${u}. جربه الآن.`, link: "[website link]", daily_budget: 5, countries: ["EG"] }),
      T("سكريبت ريل", "manual", 4, "محتوى قصير للوصول", { where: "instagram", text: `الهوك: "تعبت من [مشكلة العميل]؟"\nالمشهد: عرض ${u}\nCTA: اطلب الآن` }),
      T("مراجعة اليوم 7", "manual", 7, "قرار مبني على أرقام", { where: "other", text: "افحص: CTR وCPA لكل إعلان. أوقف الأضعف وضاعف ميزانية الأقوى." })
    ]
  } : {
    goal: b.goals || `Grow awareness and orders for ${n} in 30 days [set the target number]`,
    kpis: [{ name: "Reach", target: "[set]", measure: "Meta Insights" }, { name: "CTR", target: "1% or more", measure: "Ads Manager" }, { name: "CPA", target: "[set]", measure: "Ads Manager + your sales" }],
    tasks: [
      T("Brand intro post", "facebook_post", 1, "Lock in the core message", { text: `${n} - ${u}\nBuilt for ${a}.\nLearn more 👇`, link: "[website link]" }),
      T("Channel welcome post", "telegram_post", 2, "Build a direct audience", { text: `Welcome to ${n}. Here you get ${u}.`, link: "[website link]" }),
      T("Test ad - hook 1", "meta_ad", 3, "Test the first message", { headline: n, text: `${u}. Try it now.`, link: "[website link]", daily_budget: 5, countries: ["EG"] }),
      T("Reel script", "manual", 4, "Short-form content for reach", { where: "instagram", text: `Hook: "Tired of [customer problem]?"\nScene: show ${u}\nCTA: order now` }),
      T("Day 7 review", "manual", 7, "Decide from numbers", { where: "other", text: "Check CTR and CPA per ad. Pause the weakest and double the budget of the best." })
    ]
  };
}
async function generatePlan(uid, { lang, dialect } = {}) {
  const b = brandStore.get(uid);
  if (!b.name) throw Object.assign(new Error("Save your brand name first"), { status: 400 });
  const ar = lang === "ar";
  let raw = null;
  try { raw = await ai.completeText(PLAN_PROMPT + `\nUser language: ${ar ? "Arabic" : "English"}${ar && dialect && dialect !== "auto" ? ", dialect: " + dialect : ""}.`, "Brand profile:\n" + brandStore.format(b)); }
  catch (e) { console.error("mk plan", e.message); throw Object.assign(new Error("Geno could not build the plan right now. Please try again."), { status: 502 }); }
  let plan = raw ? clean(parseJSON(raw) || {}) : clean(fallbackPlan(b, ar));
  if (raw && !plan.tasks.length) throw Object.assign(new Error("Geno could not build a valid plan. Please try again."), { status: 502 });
  const k = getCreds(uid), now = Date.now();
  db.prepare("DELETE FROM mk_tasks WHERE user_id = ? AND status IN ('draft','failed')").run(uid);
  const ins = db.prepare("INSERT INTO mk_tasks (user_id, title, channel, content, why, day, run_at) VALUES (?,?,?,?,?,?,?)");
  for (const t of plan.tasks) {
    if (t.content.link && PH.test(t.content.link) && k.link) t.content.link = k.link;
    ins.run(uid, t.title, t.channel, JSON.stringify(t.content), t.why, t.day, new Date(now + (t.day - 1) * 86400000).toISOString());
  }
  db.prepare("INSERT INTO mk_plan (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data").run(uid, JSON.stringify({ goal: plan.goal, kpis: plan.kpis }));
  return state(uid);
}
function state(uid) {
  const p = db.prepare("SELECT data FROM mk_plan WHERE user_id = ?").get(uid);
  return { ...channelStatus(uid), plan: p ? JSON.parse(p.data) : null, tasks: listTasks(uid) };
}

/* ---------- results: what the published work achieved (read from Meta) ---------- */
async function results(uid) {
  const k = getCreds(uid), items = [], q = o => new URLSearchParams(o).toString();
  for (const t of listTasks(uid)) {
    if (t.status !== "done" || !t.result.ids) continue;
    try {
      let m = null;
      if (t.channel === "meta_ad" && k.ad_token && t.result.ids.ad) {
        const j = await http(`${G}/${t.result.ids.ad}/insights?` + q({ fields: "impressions,reach,clicks,ctr,cpc,spend", date_preset: "maximum", access_token: k.ad_token }));
        const d = (j.data || [])[0] || {}, n = (v, p = 2) => +(+v || 0).toFixed(p);
        m = { impressions: n(d.impressions, 0), reach: n(d.reach, 0), clicks: n(d.clicks, 0), ctr: n(d.ctr), cpc: n(d.cpc), spend: n(d.spend) };
      } else if (t.channel === "facebook_post" && k.fb_token && t.result.ids.post) {
        const j = await http(`${G}/${t.result.ids.post}?` + q({ fields: "reactions.summary(true).limit(0),comments.summary(true).limit(0),shares", access_token: k.fb_token }));
        m = { reactions: (j.reactions && j.reactions.summary && j.reactions.summary.total_count) || 0, comments: (j.comments && j.comments.summary && j.comments.summary.total_count) || 0, shares: (j.shares && j.shares.count) || 0 };
      }
      if (m) items.push({ id: t.id, title: t.title, channel: t.channel, metrics: m });
    } catch (e) { items.push({ id: t.id, title: t.title, channel: t.channel, error: scrub(e.message, k).slice(0, 200) }); }
  }
  const ads = items.filter(i => i.metrics && i.channel === "meta_ad").map(i => i.metrics), sum = f => ads.reduce((a, m) => a + m[f], 0);
  const totals = { impressions: sum("impressions"), clicks: sum("clicks"), spend: +sum("spend").toFixed(2) };
  totals.ctr = totals.impressions ? +(totals.clicks / totals.impressions * 100).toFixed(2) : 0; totals.cpc = totals.clicks ? +(totals.spend / totals.clicks).toFixed(2) : 0;
  return { items, totals };
}
const REVIEW_PROMPT = `You are a marketing analyst reviewing a running campaign. You get the goal, KPIs, task statuses and real measured results as JSON. Reply in plain text, no markdown, in the user's language, in this order: 1) Status against the goal (on track, behind or too early) and why, using only the numbers given. 2) What worked. 3) What to pause or fix. 4) What to scale. 5) The next 3 concrete tasks. Never invent numbers: if there is no data yet, say so and say what to publish or measure first. Never promise results.`;
async function review(uid, { lang, dialect } = {}) {
  const st = state(uid), r = await results(uid), ar = lang === "ar";
  const data = JSON.stringify({ goal: st.plan && st.plan.goal, kpis: st.plan && st.plan.kpis, tasks: st.tasks.map(t => ({ title: t.title, channel: t.channel, status: t.status, day: t.day })), results: r });
  let text = null;
  try { text = await ai.completeText(REVIEW_PROMPT + `\nUser language: ${ar ? "Arabic" : "English"}${ar && dialect && dialect !== "auto" ? ", dialect: " + dialect : ""}.`, data, 1500); } catch (e) { console.error("mk review", e.message); throw Object.assign(new Error("Geno could not review right now. Please try again."), { status: 502 }); }
  if (!text) { // demo mode
    const T = r.totals, done = st.tasks.filter(t => t.status === "done").length;
    text = ar ? `(وضع تجريبي) نُفذت ${done} من ${st.tasks.length} مهمة. الإعلانات: ${T.impressions} ظهور، ${T.clicks} نقرة، CTR ${T.ctr}%، إنفاق ${T.spend}. أضف ANTHROPIC_API_KEY للحصول على تحليل كامل مقابل هدفك.`
      : `(Demo mode) ${done} of ${st.tasks.length} tasks done. Ads: ${T.impressions} impressions, ${T.clicks} clicks, CTR ${T.ctr}%, spend ${T.spend}. Add ANTHROPIC_API_KEY for a full analysis against your goal.`;
  }
  return { text, results: r };
}

/* ---------- routes ---------- */
function routes(app, auth, limiter) {
  const wrap = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : "Something went wrong. Please try again." }); }
  };
  const own = req => { const t = getTask(req.user.id, Number(req.params.id)); if (!t) throw Object.assign(new Error("Task not found"), { status: 404 }); return t; };
  app.get("/api/mk/state", auth, wrap(req => state(req.user.id)));
  app.get("/api/mk/results", auth, limiter, wrap(req => results(req.user.id)));
  app.post("/api/mk/review", auth, limiter, wrap(req => review(req.user.id, req.body || {})));
  app.put("/api/mk/channels", auth, wrap(req => ({ ...channelStatus(req.user.id), ...saveChannels(req.user.id, req.body) })));
  app.delete("/api/mk/channels/:group", auth, wrap(req => clearGroup(req.user.id, req.params.group)));
  app.post("/api/mk/plan", auth, limiter, wrap(req => generatePlan(req.user.id, req.body || {})));
  app.put("/api/mk/tasks/:id", auth, wrap(req => {
    const t = own(req); if (["done", "running"].includes(t.status)) throw Object.assign(new Error("This task can no longer be edited"), { status: 409 });
    const b = req.body || {}, c = { ...t.content };
    for (const f of ["text", "headline", "link"]) if (typeof b[f] === "string") c[f] = s(b[f], f === "text" ? 4000 : 300);
    if (b.daily_budget !== undefined) c.daily_budget = Math.min(Math.max(Number(b.daily_budget) || 5, 1), MAX_BUDGET);
    const run_at = b.run_at && !isNaN(Date.parse(b.run_at)) ? new Date(b.run_at).toISOString() : t.run_at;
    db.prepare("UPDATE mk_tasks SET content = ?, run_at = ?, title = ? WHERE id = ?").run(JSON.stringify(c), run_at, s(b.title, 120) || t.title, t.id);
    return { task: getTask(req.user.id, t.id) };
  }));
  app.post("/api/mk/tasks/:id/schedule", auth, wrap(req => { // the owner's approval: the scheduler will run it at run_at
    const t = own(req); if (t.channel === "manual") throw Object.assign(new Error("Manual tasks cannot be scheduled"), { status: 400 });
    if (!ready(getCreds(req.user.id))[t.channel]) throw Object.assign(new Error("Connect this channel first"), { status: 400 });
    effective(t, getCreds(req.user.id));
    const at = t.run_at && t.run_at > new Date().toISOString() ? t.run_at : new Date(Date.now() + 60000).toISOString();
    db.prepare("UPDATE mk_tasks SET status = 'scheduled', run_at = ? WHERE id = ? AND status IN ('draft','failed')").run(at, t.id);
    return { task: getTask(req.user.id, t.id) };
  }));
  app.post("/api/mk/tasks/:id/run", auth, limiter, wrap(async req => ({ task: await runTask(req.user.id, own(req)) })));
  app.post("/api/mk/tasks/:id/done", auth, wrap(req => {
    const t = own(req); setResult(t.id, "done", { text: "Marked done by you", at: new Date().toISOString() }); return { task: getTask(req.user.id, t.id) };
  }));
  app.post("/api/mk/tasks/:id/reopen", auth, wrap(req => {
    const t = own(req); db.prepare("UPDATE mk_tasks SET status = 'draft', result = '{}' WHERE id = ? AND status IN ('scheduled','failed')").run(t.id); return { task: getTask(req.user.id, t.id) };
  }));
  app.delete("/api/mk/tasks/:id", auth, wrap(req => { const t = own(req); if (t.status === "running") throw Object.assign(new Error("Running"), { status: 409 }); db.prepare("DELETE FROM mk_tasks WHERE id = ?").run(t.id); return { ok: true }; }));
}

module.exports = { results, review, routes, startScheduler, generatePlan, runTask, tick, state, saveChannels, getCreds, parseJSON, clean, RUNNERS, effective };
