"use strict";
const $ = s => document.querySelector(s);
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const P = {
  chat: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" fill="currentColor"/><path d="M12 8.5v7M8.5 12h7" stroke="#bbb" stroke-width="1.8"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  gear: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 14v6h16v-6"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  send: '<path d="M3 11l18-8-8 18-2-8z" fill="currentColor"/>',
  back: '<path d="M9 5L4 10l5 5M4 10h10a6 6 0 0 1 0 12h-3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="currentColor"/><circle cx="12" cy="13" r="3.5" fill="#ddd"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/>'
};
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LOGO = w => `<img class="logo" style="width:${w}px;height:auto" alt="Geno" src="logo.png">`;
const BOT = '<span class="bav"><svg width="18" height="10" viewBox="0 0 18 10"><circle cx="5" cy="5" r="3" fill="#fff"/><circle cx="13" cy="5" r="3" fill="#1e90e8"/></svg></span>';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- state ---------- */
let token = ls.get("geno_token", null), me = null, chats = [], cur = null, msgs = [], files = [];
let pending = false, chatVer = 0, sideMode = "history", pendAv = null, devOpen = false, delOpen = false;
let recording = false, recBars = [], chunks = [], mr = null, an = null, ac = null, stream = null, tick = null, rc = null, transcript = "", aud = null;
let S = Object.assign({ dark: true, lang: "en", spoken: "auto", dialect: "auto", mode: "general", persona: "funny" }, ls.get("geno_set", {}));
let cfg = { stt: false, plans: [], currency: "EGP", payment: { methods: [], instructions: "" } }, planSel = null, payStep = false, memItems = [];
const MODES = [["general", "General"], ["student", "Student"], ["business", "Business"], ["freelancer", "Freelance"], ["gov", "Gov. help"], ["meeting", "Meeting notes"], ["tutor", "English coach"], ["mk_strategy", "Strategy"], ["mk_content", "Content"], ["mk_media", "Media buying"], ["mk_analytics", "Analytics"], ["mk_video", "Video ads"], ["mk_seo", "SEO & GEO"], ["mk_exec", "Execute"]];

/* ---------- i18n / theme ---------- */
const T = { ar: { "welcome": "أهلاً بك", "history": "السجل", "Message Geno…": "اكتب رسالة لجينو…", "Setting": "الإعدادات", "Dark theme": "الوضع الداكن", "Language": "اللغة", "Spoken Language": "لغة التحدث", "Devices": "الأجهزة", "Manage plan": "إدارة الباقة", "Clear history": "مسح السجل", "Log out": "تسجيل الخروج", "Login": "تسجيل الدخول", "Sign up": "إنشاء حساب", "username": "اسم المستخدم", "password": "كلمة المرور", "confirm password": "تأكيد كلمة المرور", "Account": "الحساب", "Username": "اسم المستخدم", "Birth day": "تاريخ الميلاد", "Save changes": "حفظ التغييرات", "Plans": "الباقات", "Upgrade now": "رقّي الآن", "Exit": "خروج", "No chats yet": "لا توجد محادثات", "New chat": "محادثة جديدة", "this device": "هذا الجهاز", "Dialect": "اللهجة", "Personality": "الشخصية", "Serious": "جاد", "Funny": "خفيف الظل", "Roast": "سخرية", "Memory": "الذاكرة", "Title": "العنوان", "Note": "الملاحظة", "Import .txt/.md": "استيراد ملف", "Save note": "حفظ الملاحظة", "Saved": "تم الحفظ", "memoryHint": "احفظ ملاحظاتك ومستنداتك وسيستخدمها Geno عند الإجابة. بياناتك خاصة بحسابك ويمكنك حذفها.", "Today": "اليوم", "messages": "رسالة", "Current": "الحالية", "month": "شهر", "messages per day": "رسالة يومياً", "Payment reference / transaction number": "رقم العملية / المرجع", "I paid": "تم الدفع", "Back": "رجوع", "General": "عام", "Student": "طالب", "Business": "أعمال", "Freelance": "فريلانس", "Gov. help": "إجراءات حكومية", "Meeting notes": "محاضر اجتماعات", "English coach": "مدرّب إنجليزي", "Strategy": "استراتيجية", "Content": "محتوى", "Media buying": "شراء إعلانات", "Analytics": "تحليلات", "Video ads": "إعلانات فيديو", "SEO & GEO": "سيو وجيو", "Brand profile": "هوية البراند", "Brand name": "اسم البراند", "Industry": "المجال", "Target audience": "الجمهور المستهدف", "Tone of voice": "أسلوب الكلام", "Unique selling points": "ما يميز البراند", "Competitors": "المنافسون", "Goals and budget": "الأهداف والميزانية", "Other notes": "ملاحظات أخرى", "brandHint": "املأ بيانات البراند مرة واحدة واضغط حفظ، وسيستخدمها Geno تلقائياً.", "Use automatically in all chats": "استخدمها تلقائياً في كل المحادثات", "brandActive": "✓ مفعّلة: Geno يستخدم هوية البراند تلقائياً", "brandInactive": "لم تُحفظ بعد", "Saved, Geno will use it automatically": "تم الحفظ، سيستخدمها Geno تلقائياً", "Save brand": "حفظ بيانات البراند", "Execute": "تنفيذ", "Execution plan": "خطة التنفيذ" } };
const t = k => (T[S.lang] || {})[k] || k;
function applyS() { const h = document.documentElement; h.dataset.theme = S.dark ? "dark" : "light"; h.lang = S.lang; }
function setS(k, v) {
  S[k] = v; ls.set("geno_set", S); applyS();
  if (me && (k === "lang" || k === "dark")) { renderTop(); renderStage(); if (!recording) renderBar(); renderModes(); renderSide(); }
}
function toast(m) { const d = document.createElement("div"); d.className = "toast"; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }

/* ---------- API ---------- */
async function api(path, opt = {}) {
  const h = {};
  if (token) h.Authorization = "Bearer " + token;
  let body = opt.body;
  if (body && !(body instanceof FormData)) { body = JSON.stringify(body); h["Content-Type"] = "application/json"; }
  const r = await fetch("/api" + path, { method: opt.method || "GET", headers: h, body });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (r.status === 401 && token && !path.startsWith("/auth")) { logout(); toast("Please log in again"); }
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}
const fromS = m => ({
  r: m.role === "user" ? "u" : "b", type: m.type, text: m.text, bars: m.bars, url: m.audio,
  files: (m.files || []).map(f => ({ name: f.name, url: f.url, img: /^image\//.test(f.mime), vid: /^video\//.test(f.mime) }))
});

/* ---------- auth ---------- */
function renderAuth(mode) {
  const su = mode === "signup";
  $("#app").innerHTML = `<div class="auth"><div class="atop">${LOGO(110)}</div><div class="card" onkeydown="if(event.key==='Enter')document.querySelector('.pill').click()">
    ${su ? `<button class="back" onclick="renderAuth('login')">${ic("back", 22)}</button>` : ""}
    <h1>${t(su ? "Sign up" : "Login")}</h1>
    <label>${t("username")}</label><input id="u" autocomplete="username">
    <label>${t("password")}</label><input id="p" type="password" autocomplete="${su ? "new-password" : "current-password"}">
    ${su ? `<label>${t("confirm password")}</label><input id="p2" type="password" autocomplete="new-password">` : ""}
    <div class="err" id="err"></div>
    <button class="pill" onclick="${su ? "doSignup()" : "doLogin()"}">${t(su ? "Sign up" : "Login")}</button>
    ${su ? "" : `<a onclick="renderAuth('signup')">${t("Sign up")}</a>`}
    <p class="lgl">${su ? (S.lang === "ar" ? "بالتسجيل أنت توافق على " : "By signing up you agree to the ") : ""}<a href="/terms" target="_blank" rel="noopener">${S.lang === "ar" ? "الشروط" : "Terms"}</a> · <a href="/privacy" target="_blank" rel="noopener">${S.lang === "ar" ? "الخصوصية" : "Privacy"}</a></p>
  </div></div>`;
}
async function doLogin() {
  try { await enter(await api("/auth/login", { method: "POST", body: { username: $("#u").value.trim(), password: $("#p").value } })); }
  catch (e) { $("#err").textContent = e.message; }
}
async function doSignup() {
  if ($("#p").value !== $("#p2").value) { $("#err").textContent = "Passwords do not match"; return; }
  try { await enter(await api("/auth/signup", { method: "POST", body: { username: $("#u").value.trim(), password: $("#p").value } })); }
  catch (e) { $("#err").textContent = e.message; }
}
async function enter(d) {
  token = d.token; ls.set("geno_token", token); me = d.user;
  try { brand = (await api("/brand")).brand; } catch (e) { brand = {}; }
  chats = (await api("/chats")).chats; cur = null; msgs = []; files = []; sideMode = "history"; chatVer++;
  renderApp();
}
function logout() {
  stopPlay(); brand = {}; token = null; me = null; chats = []; cur = null; msgs = []; files = [];
  ls.set("geno_token", null); renderAuth("login");
}

/* ---------- shell ---------- */
function renderApp() {
  $("#app").innerHTML = `<div class="shell empty"><section class="main">
    <header class="top"><div id="tl"></div><div class="ticons" id="ti"></div></header>
    <div class="stage" id="stage"></div>
    <div class="dock"><div class="modes" id="modes"></div><div class="tray" id="tray" hidden></div><div class="bar" id="bar"></div></div>
  </section><aside class="side" id="side"></aside><div class="plans" id="plans" hidden></div></div>`;
  renderTop(); renderStage(); renderBar(); renderModes(); renderSide();
}
function renderModes() { $("#modes").innerHTML = (brand.name ? `<button class="mc brandchip" onclick="openBrand()">🏷 ${esc(brand.name)}${brand.auto === false ? " (off)" : ""}</button><button class="mc brandchip" onclick="openPlan()">🎯 ${L("Execution plan", "خطة التنفيذ")}</button>` : "") + MODES.map(([id, l]) => `<button class="mc ${S.mode === id ? "on" : ""}" onclick="setMode('${id}')">${id.startsWith("mk_") ? "📣 " : ""}${t(l)}</button>`).join(""); }
function setMode(id) { S.mode = id; ls.set("geno_set", S); renderModes(); }
const avatarHTML = cls => `<span class="${cls}" ${me && me.avatar ? `style="background-image:url(${me.avatar})"` : ""}></span>`;
function renderTop() {
  $("#tl").innerHTML = LOGO(96);
  $("#ti").innerHTML = `<button class="ib" style="color:#000" onclick="openSide('history')">${ic("chat", 18)}</button><button class="ib" style="color:#000" onclick="openSide('settings')">${ic("gear", 18)}</button><button onclick="openAcc()">${avatarHTML("av")}</button>`;
}
function renderSide() {
  const s = $("#side"), prevMode = s.dataset.mode; s.dataset.mode = sideMode;
  if (sideMode === "account") {
    s.innerHTML = `<div class="ah"><button class="ib" onclick="backSide()">${ic("back", 22)}</button><h2>${t("Account")}</h2></div>
    <div class="acc scr"><button class="cam" onclick="document.getElementById('avf').click()">${me.avatar ? `<img src="${me.avatar}">` : ic("camera", 34)}</button>
    <input id="avf" type="file" accept="image/*" hidden onchange="pickAvatar(this)">
    <label>${t("Username")}</label><input id="au" value="${esc(me.username)}">
    <label>${t("password")}</label><input id="ap" type="password" placeholder="••••••" autocomplete="new-password">
    <label>${t("Birth day")}</label><input id="ab" type="date" value="${esc(me.birth || "")}">
    <div class="err" id="aerr"></div><button class="save" onclick="saveAcc()">${t("Save changes")}</button>
    <button class="rw big" onclick="exportData()"><span>${L("Export my data", "تصدير بياناتي")}</span></button>
    <button class="rw big" style="color:#e0584a" onclick="delOpen=!delOpen;renderSide()"><span>${L("Delete my account", "حذف حسابي")}</span></button>
    ${delOpen ? `<p class="mut" style="padding:0">${L("This permanently deletes your chats, files, brand, plan and connected channels. Enter your password to confirm.", "سيُحذف كل شيء نهائياً: المحادثات والملفات والبراند والخطة والقنوات. أدخل كلمة المرور للتأكيد.")}</p><input id="dpw" type="password" autocomplete="current-password" placeholder="••••••"><button class="save" style="background:#c0392b" onclick="delAccount()">${L("Delete forever", "احذف نهائياً")}</button>` : ""}
    <p class="lgl"><a href="/terms" target="_blank" rel="noopener">${L("Terms", "الشروط")}</a> · <a href="/privacy" target="_blank" rel="noopener">${L("Privacy", "الخصوصية")}</a> · <a href="/data-deletion" target="_blank" rel="noopener">${L("Data deletion", "حذف البيانات")}</a></p></div>`;
    return;
  }
  if (sideMode === "brand") {
    s.innerHTML = `<div class="ah"><button class="ib" onclick="openSide('settings')">${ic("back", 22)}</button><h2>${t("Brand profile")}</h2></div>
    <div class="acc scr"><p class="mut" style="padding:0">${S.lang === "ar" ? t("brandHint") : "Fill in your brand details once and press Save. Geno will use them automatically."}</p>
    <p class="bstat">${S.lang === "ar" ? (brand.name ? t("brandActive") : t("brandInactive")) : (brand.name ? "✓ Active: Geno uses this brand profile automatically" : "Not set yet")}</p>
    <div class="rw"><span>${S.lang === "ar" ? t("Use automatically in all chats") : "Use automatically in all chats"}</span><button class="sw ${brand.auto !== false ? "on" : ""}" onclick="brand.auto = brand.auto === false; this.classList.toggle('on')"></button></div>
    ${BF.map(([k, l]) => `<label>${t(l)}</label>${k === "name" || k === "industry" ? `<input id="br_${k}" value="${esc(brand[k] || "")}">` : `<textarea id="br_${k}" style="min-height:60px">${esc(brand[k] || "")}</textarea>`}`).join("")}
    </div>
    <div class="sbar"><button class="save wide" onclick="saveBrand()">💾 ${t("Save brand")}</button></div>`;
    return;
  }
  if (sideMode === "plan") { renderPlan(s, prevMode === "plan"); return; }
  if (sideMode === "memory") {
    s.innerHTML = `<div class="ah"><button class="ib" onclick="openSide('settings')">${ic("back", 22)}</button><h2>${t("Memory")}</h2></div>
    <div class="acc"><p class="mut" style="padding:0">${t("memoryHint")}</p>
    <input id="mt" placeholder="${t("Title")}"><textarea id="mx" placeholder="${t("Note")}"></textarea>
    <div class="mrow"><button class="save" style="margin:0;background:#222" onclick="document.getElementById('mf').click()">${t("Import .txt/.md")}</button><input id="mf" type="file" accept=".txt,.md,text/plain,text/markdown" hidden onchange="importMem(this)"><button class="save" style="margin:0" onclick="addMem()">${t("Save note")}</button></div>
    <div class="err" id="merr"></div>
    ${memItems.map(n => `<div class="mem"><span><b>${esc(n.title)}</b><br>${esc(n.preview.slice(0, 80))}${n.preview.length > 80 ? "…" : ""}</span><button onclick="delMem(${n.id})">${ic("x", 16)}</button></div>`).join("")}</div>`;
    return;
  }
  if (sideMode === "settings") {
    const ua = navigator.userAgent, dv = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "phone" : "laptop";
    const o = (v, l, c) => `<option value="${v}" ${v === c ? "selected" : ""}>${l}</option>`;
    s.innerHTML = `<div class="sh"><button class="ib" onclick="backSide()">${ic("back", 22)}</button><span class="sp"></span><button class="un" onclick="openAcc()">${esc(me.username)}${avatarHTML("av s")}</button></div>
    <div class="set"><h3 style="padding:8px 0">${t("Setting")}</h3>
    <div class="rw"><span>${t("Dark theme")}</span><button class="sw ${S.dark ? "on" : ""}" onclick="setS('dark',${!S.dark})"></button></div>
    <div class="rw"><span>${t("Language")}</span><select onchange="setS('lang',this.value)">${o("en", "English", S.lang)}${o("ar", "عربي", S.lang)}</select></div>
    <div class="rw"><span>${t("Spoken Language")}</span><select onchange="setS('spoken',this.value)">${o("auto", "Auto", S.spoken)}${o("en", "English", S.spoken)}${o("ar", "عربي", S.spoken)}</select></div>
    <div class="rw"><span>${t("Personality")}</span><select onchange="setS('persona',this.value)">${o("serious", t("Serious"), S.persona)}${o("funny", t("Funny"), S.persona)}${o("roast", t("Roast"), S.persona)}</select></div>
    <div class="rw"><span>${t("Dialect")}</span><select onchange="setS('dialect',this.value)">${o("auto", "Auto", S.dialect)}${o("egyptian", "مصري", S.dialect)}${o("gulf", "خليجي", S.dialect)}${o("levantine", "شامي", S.dialect)}${o("msa", "فصحى", S.dialect)}</select></div>
    <button class="rw big" onclick="devOpen=!devOpen;renderSide()"><span>${t("Devices")}</span><span class="chev ${devOpen ? "open" : ""}">${ic("chev", 18)}</span></button>
    ${devOpen ? `<div class="dev">${["phone", "tablet", "laptop"].map(d => `<span class="${d === dv ? "me" : ""}">${d}${d === dv ? " · " + t("this device") : ""}</span>`).join("")}</div>` : ""}
    <button class="rw big" onclick="openPlan()"><span>🎯 ${L("Execution plan", "خطة التنفيذ")}</span><span class="chev" style="transform:rotate(-90deg)">${ic("chev", 18)}</span></button>
    <button class="rw big" onclick="openBrand()"><span>${t("Brand profile")}</span><span class="chev" style="transform:rotate(-90deg)">${ic("chev", 18)}</span></button>
    <button class="rw big" onclick="openMemory()"><span>${t("Memory")}</span><span class="chev" style="transform:rotate(-90deg)">${ic("chev", 18)}</span></button>
    <button class="rw big" onclick="openPlans()"><span>${t("Manage plan")}</span><span class="chev" style="transform:rotate(-90deg)">${ic("chev", 18)}</span></button>
    <button class="rw big" onclick="clearAll()">${t("Clear history")}</button>
    <button class="rw big" onclick="logout()">${t("Log out")}</button></div>`;
    return;
  }
  s.innerHTML = `<div class="sh"><button class="ib" title="New chat" onclick="newChat()">${ic("chat", 18)}</button><button class="ib" onclick="openSide('settings')">${ic("gear", 18)}</button><span class="sp"></span><button class="un" onclick="openAcc()">${esc(me.username)}${avatarHTML("av s")}</button><button class="ib xm" onclick="closeSide()">${ic("x", 18)}</button></div>
  <h3>${t("history")}</h3><div class="list">${chats.length ? chats.map(c => `<button class="hi ${c.id === cur ? "on" : ""}" onclick="openChat(${c.id})">${esc(c.title || t("New chat"))}</button>`).join("") : `<p class="mut">${t("No chats yet")}</p>`}</div>`;
}
const refreshSide = () => { if (sideMode === "history") renderSide(); };
function openSide(m) { sideMode = m; renderSide(); $("#side").classList.add("open"); }
function closeSide() { $("#side").classList.remove("open"); }
function openAcc() { pendAv = null; openSide("account"); }
function backSide() { sideMode = "history"; renderSide(); closeSide(); }
function pickAvatar(i) {
  const f = i.files[0]; if (!f) return;
  const im = new Image();
  im.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const m = Math.min(im.width, im.height);
    c.getContext("2d").drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 128, 128);
    pendAv = c.toDataURL("image/jpeg", .8);
    $(".cam").innerHTML = `<img src="${pendAv}">`;
  };
  im.src = URL.createObjectURL(f);
}
async function saveAcc() {
  const body = { username: $("#au").value.trim(), birth: $("#ab").value };
  if ($("#ap").value) body.password = $("#ap").value;
  if (pendAv) body.avatar = pendAv;
  try { me = (await api("/me", { method: "PUT", body })).user; pendAv = null; renderTop(); renderStage(); renderSide(); toast("Changes saved"); }
  catch (e) { $("#aerr").textContent = e.message; }
}

/* ---------- brand kickoff + one-tap execution ---------- */
const EX = [
  ["14-day content calendar with full captions", "تقويم محتوى 14 يوم بالكابشنز كاملة"],
  ["3 ready ad angles (Meta, TikTok, Google)", "3 زوايا إعلانية جاهزة (ميتا وتيك توك وجوجل)"],
  ["3 short video scripts + AI video prompts", "3 سكريبتات فيديو قصيرة + برومبتات"],
  ["SEO & GEO pack: pages, FAQ, schema", "حزمة سيو وجيو: صفحات وأسئلة وschema"],
  ["Step-by-step Meta campaign build sheet", "خطة بناء حملة ميتا خطوة بخطوة"],
  ["WhatsApp & email follow-up sequences", "رسائل واتساب وإيميل للمتابعة والبيع"]
];
async function kickoff() {
  const ver = ++chatVer, ar = S.lang === "ar";
  cur = null; msgs = [{ r: "u", type: "text", text: ar ? `ابدأ شغل التسويق على البراند: ${brand.name}` : `Start the marketing work for my brand: ${brand.name}` }];
  pending = true; closeSide(); renderStage();
  let d = null, err = null;
  try { d = await api("/brand/kickoff", { method: "POST", body: { lang: S.lang, dialect: S.dialect } }); } catch (e) { err = e; }
  pending = false;
  if (d && !chats.some(c => c.id === d.chatId)) chats.unshift({ id: d.chatId, title: d.title });
  if (ver === chatVer) {
    if (d) { cur = d.chatId; me.usage = d.usage; msgs = [fromS(d.user), fromS(d.bot)]; setMode("mk_exec"); }
    else msgs.push({ r: "b", type: "text", text: "⚠ " + err.message });
  }
  renderStage(); refreshSide();
}
function runExec(i) { if (pending) return; S.mode = "mk_exec"; ls.set("geno_set", S); renderModes(); submit({ text: (S.lang === "ar" ? "نفذ الآن: " : "Execute now: ") + EX[i][S.lang === "ar" ? 1 : 0] }); }
const execChips = () => `<div class="xchips"><button class="xc go" onclick="openPlan()">🎯 ${L("Open the real execution plan", "افتح خطة التنفيذ الفعلي")}</button><span class="xl">${S.lang === "ar" ? "⚡ نفّذ الآن:" : "⚡ Execute now:"}</span>${EX.map((x, i) => `<button class="xc" onclick="runExec(${i})">${x[S.lang === "ar" ? 1 : 0]}</button>`).join("")}</div>`;

async function exportData() { try { const d = await api("/me/export"), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" })); a.download = "geno-export.json"; a.click(); } catch (e) { toast(e.message); } }
async function delAccount() { try { await api("/me", { method: "DELETE", body: { password: $("#dpw").value } }); delOpen = false; logout(); toast(L("Account deleted", "تم حذف الحساب")); } catch (e) { toast(e.message); } }

/* ---------- execution plan: real publishing / scheduling after the owner approves ---------- */
const L = (e, a) => S.lang === "ar" ? a : e;
let mk = { res: null, rev: "", resBusy: false, ready: {}, values: {}, plan: null, tasks: [], busy: false, conf: null, chOpen: false, maxBudget: 50 };
const CHL = { facebook_post: ["📘", "Facebook post", "منشور فيسبوك"], telegram_post: ["✈️", "Telegram post", "منشور تيليجرام"], meta_ad: ["🎯", "Meta ad (created paused)", "إعلان ميتا (يُنشأ متوقفاً)"], manual: ["🖐", "Manual", "يدوي"] };
const STL = { draft: ["Draft", "مسودة"], scheduled: ["Scheduled", "مجدول"], running: ["Running…", "جارٍ التنفيذ…"], done: ["Done", "تم"], failed: ["Failed", "فشل"] };
const fmtAt = iso => { try { return new Date(iso).toLocaleString(S.lang === "ar" ? "ar-EG" : undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
async function openPlan() { try { Object.assign(mk, await api("/mk/state"), { conf: null }); openSide("plan"); } catch (e) { toast(e.message); } }
function mkRender() { if (sideMode === "plan") renderSide(); }
async function mkGen() {
  if (mk.busy) return; mk.busy = true; mkRender();
  try { Object.assign(mk, await api("/mk/plan", { method: "POST", body: { lang: S.lang, dialect: S.dialect } })); } catch (e) { toast(e.message); }
  mk.busy = false; mkRender();
}
const mkSet = k => { const i = mk.tasks.findIndex(x => x.id === k.id); if (i >= 0) mk.tasks[i] = k; };
async function mkCall(id, action, method = "POST") {
  try { const d = await api(`/mk/tasks/${id}${action}`, { method }); if (d.task) mkSet(d.task); else mk.tasks = mk.tasks.filter(x => x.id !== id); return d.task; }
  catch (e) { toast(e.message); }
}
async function mkEdit(id) {
  const v = n => { const e = document.getElementById(n + "_" + id); return e ? e.value : undefined; };
  const body = { text: v("mkt"), link: v("mkl"), headline: v("mkh"), daily_budget: v("mkb") };
  Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
  try { mkSet((await api("/mk/tasks/" + id, { method: "PUT", body })).task); toast(L("Saved", "تم الحفظ")); } catch (e) { toast(e.message); }
}
async function mkRun(id) {
  if (mk.conf !== id) { mk.conf = id; mkRender(); setTimeout(() => { if (mk.conf === id) { mk.conf = null; mkRender(); } }, 4000); return; }
  mk.conf = null; const t = mk.tasks.find(x => x.id === id); if (t) t.status = "running"; mkRender();
  const r = await mkCall(id, "/run"); mkRender();
  if (r) toast(r.status === "done" ? "✓ " + L("Done", "تم التنفيذ") : "⚠ " + (r.result.error || ""));
}
async function mkSchedule(id) { const r = await mkCall(id, "/schedule"); mkRender(); if (r) toast("📅 " + L("Scheduled for ", "تمت الجدولة: ") + fmtAt(r.run_at)); }
async function mkDone(id) { await mkCall(id, "/done"); mkRender(); }
async function mkReopen(id) { await mkCall(id, "/reopen"); mkRender(); }
async function mkDel(id) { await mkCall(id, "", "DELETE"); mkRender(); }
function mkCopy(id) {
  const k = mk.tasks.find(x => x.id === id); if (!k) return; const c = k.content, txt = [c.headline, c.text, c.link].filter(Boolean).join("\n\n");
  const fb = () => { const a = document.createElement("textarea"); a.value = txt; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); toast(L("Copied", "تم النسخ")); } catch (e) { toast("Copy failed"); } a.remove(); };
  try { navigator.clipboard.writeText(txt).then(() => toast(L("Copied", "تم النسخ")), fb); } catch (e) { fb(); }
}
async function mkSaveCh() {
  const g = id => (document.getElementById("ch_" + id) || {}).value || "", o = {};
  ["fb_page_id", "fb_token", "tg_token", "tg_chat", "ad_account", "ad_page_id", "ad_token", "link"].forEach(k => o[k] = g(k));
  try { Object.assign(mk, await api("/mk/channels", { method: "PUT", body: o })); toast(L("Channels saved", "تم حفظ القنوات")); mkRender(); } catch (e) { toast(e.message); }
}
async function mkDisc(g) { try { Object.assign(mk, await api("/mk/channels/" + g, { method: "DELETE" })); mkRender(); } catch (e) { toast(e.message); } }
function mkTaskHTML(k) {
  const c = k.content || {}, [ico, en, ar] = CHL[k.channel] || CHL.manual, man = k.channel === "manual", ok = mk.ready[k.channel], lock = k.status === "done" || k.status === "running";
  const f = (id, v, ph, cls = "") => `<input id="${id}_${k.id}" class="${cls}" value="${esc(v || "")}" placeholder="${ph}" onchange="mkEdit(${k.id})" ${lock ? "disabled" : ""}>`;
  const run = k.status === "running" ? "" : man ? (k.status === "done" ? "" : `<button class="tb pri" onclick="mkDone(${k.id})">✓ ${L("Mark done", "تم تنفيذها")}</button>`)
    : k.status === "done" ? "" : ok ? `<button class="tb pri" onclick="mkRun(${k.id})">${mk.conf === k.id ? "⚠ " + L("Confirm: publish for real", "تأكيد: نفّذ فعلياً الآن") : "▶ " + L("Run now", "نفّذ الآن")}</button>${k.status === "scheduled" ? `<button class="tb" onclick="mkReopen(${k.id})">${L("Unschedule", "إلغاء الجدولة")}</button>` : `<button class="tb" onclick="mkSchedule(${k.id})">📅 ${L("Approve & schedule", "اعتماد وجدولة")}</button>`}` : `<button class="tb" onclick="mk.chOpen=true;mkRender()">🔌 ${L("Connect this channel", "اربط هذه القناة")}</button>`;
  const res = k.status === "done" ? `<p class="mkr ok">✓ ${esc(k.result.text || "")}${k.result.url ? ` <a href="${esc(k.result.url)}" target="_blank" rel="noopener">${L("Open", "فتح")}</a>` : ""}</p>`
    : k.status === "failed" ? `<p class="mkr bad">⚠ ${esc(k.result.error || "")}</p>` : k.status === "scheduled" ? `<p class="mkr">📅 ${fmtAt(k.run_at)}</p>` : "";
  return `<div class="tk"><div class="tkh"><span class="bd">${ico} ${L(en, ar)}${man && c.where ? " · " + esc(c.where) : ""}</span><span class="bd st-${k.status}">${L(...STL[k.status])}</span><span class="bd">${L("Day", "يوم")} ${k.day}</span></div>
    <b>${esc(k.title)}</b>${k.why ? `<p class="mut" style="padding:0">${esc(k.why)}</p>` : ""}
    ${k.channel === "meta_ad" ? f("mkh", c.headline, L("Headline", "العنوان")) : ""}
    <textarea id="mkt_${k.id}" style="min-height:90px" onchange="mkEdit(${k.id})" ${lock ? "disabled" : ""}>${esc(c.text || "")}</textarea>
    ${man ? "" : f("mkl", c.link, L("Link (https://…)", "الرابط (https://…)"))}
    ${k.channel === "meta_ad" ? `<label>${L("Daily test budget (max " + mk.maxBudget + ")", "ميزانية اختبار يومية (الحد " + mk.maxBudget + ")")}</label><input id="mkb_${k.id}" type="number" min="1" max="${mk.maxBudget}" value="${c.daily_budget || 5}" onchange="mkEdit(${k.id})" ${lock ? "disabled" : ""}>` : ""}
    ${res}<div class="tka">${run}<button class="tb" onclick="mkCopy(${k.id})">${L("Copy", "نسخ")}</button><button class="tb dng" onclick="mkDel(${k.id})" ${k.status === "running" ? "disabled" : ""}>🗑</button></div></div>`;
}
async function mkRes() { if (mk.resBusy) return; mk.resBusy = true; mkRender(); try { mk.res = await api("/mk/results"); } catch (e) { toast(e.message); } mk.resBusy = false; mkRender(); }
async function mkReview() { if (mk.resBusy) return; mk.resBusy = true; mkRender(); try { const d = await api("/mk/review", { method: "POST", body: { lang: S.lang, dialect: S.dialect } }); mk.rev = d.text; mk.res = d.results; } catch (e) { toast(e.message); } mk.resBusy = false; mkRender(); }
const resHTML = () => { const r = mk.res; return `<div class="tk"><b>📊 ${L("Results vs goal", "النتائج مقابل الهدف")}</b>
  ${r ? `<div class="kpi">${L("Impressions", "ظهور")} <b>${r.totals.impressions}</b> · ${L("Clicks", "نقرات")} <b>${r.totals.clicks}</b> · CTR <b>${r.totals.ctr}%</b> · CPC <b>${r.totals.cpc}</b> · ${L("Spend", "إنفاق")} <b>${r.totals.spend}</b></div>${r.items.map(i => `<div class="kpi">${esc(i.title)}: ${i.error ? `<span class="mkr bad">${esc(i.error)}</span>` : Object.entries(i.metrics).map(([k, v]) => k + " " + v).join(" · ")}</div>`).join("")}` : `<p class="mut" style="padding:0">${L("Press refresh to read the numbers from Meta.", "اضغط تحديث لقراءة الأرقام من ميتا.")}</p>`}
  ${mk.rev ? `<p style="white-space:pre-wrap;margin:6px 0 0">${esc(mk.rev)}</p>` : ""}
  <div class="tka"><button class="tb" onclick="mkRes()" ${mk.resBusy ? "disabled" : ""}>↻ ${L("Refresh results", "تحديث النتائج")}</button><button class="tb pri" onclick="mkReview()" ${mk.resBusy ? "disabled" : ""}>🧠 ${mk.resBusy ? "…" : L("Review vs goal", "راجع مقابل الهدف")}</button></div></div>`; };
function renderPlan(s, same) {
  const y = same ? (s.querySelector(".scr") || {}).scrollTop || 0 : 0, p = mk.plan, V = mk.values || {};
  const ci = (id, ph, secret) => `<input id="ch_${id}" ${secret ? 'type="password" autocomplete="off"' : ""} value="${secret ? "" : esc(V[id] || "")}" placeholder="${secret && mk.ready[secret] ? "•••••• " + L("saved", "محفوظ") : ph}">`;
  const grp = (g, key, title, hint, fields) => `<div class="chg"><div class="chh"><b>${mk.ready[key] ? "✅" : "⚪"} ${title}</b>${mk.ready[key] ? `<button class="tb" onclick="mkDisc('${g}')">${L("Disconnect", "فصل")}</button>` : ""}</div><p class="mut" style="padding:0">${hint}</p>${fields}</div>`;
  s.innerHTML = `<div class="ah"><button class="ib" onclick="openSide('settings')">${ic("back", 22)}</button><h2>🎯 ${L("Execution plan", "خطة التنفيذ")}</h2></div>
  <div class="acc scr">
    ${p ? `<div class="tk"><b>🎯 ${L("Goal", "الهدف")}</b><p style="margin:4px 0">${esc(p.goal)}</p>${(p.kpis || []).map(k => `<div class="kpi"><b>${esc(k.name)}</b> → ${esc(k.target)}<span class="mut" style="padding:0"> · ${esc(k.measure)}</span></div>`).join("")}</div>` : `<p class="mut" style="padding:0">${L("Geno turns your brand goals into a concrete plan: real posts, ads and tasks. Nothing is published until you approve it.", "يحوّل Geno أهداف البراند إلى خطة عملية: منشورات وإعلانات ومهام حقيقية. لن يُنشر شيء إلا بعد موافقتك.")}</p>`}
    <button class="tb pri" style="padding:10px 14px;font-size:13px" onclick="mkGen()" ${mk.busy ? "disabled" : ""}>${mk.busy ? L("Geno is building the plan…", "Geno يبني الخطة…") : p ? "↻ " + L("Rebuild plan (keeps finished tasks)", "إعادة بناء الخطة (تبقى المهام المنفذة)") : "⚡ " + L("Build my execution plan", "ابنِ خطة التنفيذ")}</button>
    ${mk.tasks.map(mkTaskHTML).join("")}
    ${mk.tasks.some(t => t.status === "done" && t.result && t.result.ids) || mk.res ? resHTML() : ""}
    <button class="rw big" onclick="mk.chOpen=!mk.chOpen;mkRender()"><span>🔌 ${L("Channels (to publish for real)", "القنوات (للنشر الفعلي)")}</span><span class="chev ${mk.chOpen ? "open" : ""}">${ic("chev", 18)}</span></button>
    ${mk.chOpen ? `<p class="mut" style="padding:0">${L("Tokens are stored encrypted and never shown again. Everything is posted only after you press Run or approve. Ads are always created paused.", "التوكنات تُحفظ مشفرة ولا تظهر مرة أخرى. لا يُنشر شيء إلا بعد ضغطك تنفيذ أو اعتماد. الإعلانات تُنشأ دائماً متوقفة.")}</p>
      <label>${L("Website link (used when a task has no link)", "رابط موقعك (يُستخدم عند غياب رابط في المهمة)")}</label>${ci("link", "https://…")}
      ${grp("fb", "facebook_post", "Facebook Page", L("Page ID + Page access token (permission: pages_manage_posts).", "رقم الصفحة + توكن الصفحة (صلاحية pages_manage_posts)."), ci("fb_page_id", "Page ID") + ci("fb_token", "Page access token", "facebook_post"))}
      ${grp("tg", "telegram_post", "Telegram", L("Bot token from @BotFather; add the bot as admin of your channel.", "توكن البوت من @BotFather وأضف البوت مشرفاً في قناتك."), ci("tg_token", "Bot token", "telegram_post") + ci("tg_chat", "@channel_username"))}
      ${grp("ad", "meta_ad", "Meta Ads", L("Ad account ID, Page ID and a token with ads_management.", "رقم الحساب الإعلاني ورقم الصفحة وتوكن بصلاحية ads_management."), ci("ad_account", "act_123456789") + ci("ad_page_id", "Page ID") + ci("ad_token", "Access token", "meta_ad"))}` : ""}
  </div>
  ${mk.chOpen ? `<div class="sbar"><button class="save wide" onclick="mkSaveCh()">💾 ${L("Save channels", "حفظ القنوات")}</button></div>` : ""}`;
  const sc = s.querySelector(".scr"); if (sc) sc.scrollTop = y;
}

/* ---------- brand profile (used by the marketing modes) ---------- */
let brand = {};
const BF = [["name", "Brand name"], ["industry", "Industry"], ["audience", "Target audience"], ["tone", "Tone of voice"], ["usp", "Unique selling points"], ["competitors", "Competitors"], ["goals", "Goals and budget"], ["notes", "Other notes"]];
async function openBrand() { try { brand = (await api("/brand")).brand; openSide("brand"); } catch (e) { toast(e.message); } }
async function saveBrand() {
  const b = { auto: brand.auto !== false }; BF.forEach(([k]) => b[k] = $("#br_" + k).value);
  try { brand = (await api("/brand", { method: "PUT", body: b })).brand; renderModes(); renderSide(); toast(S.lang === "ar" ? t("Saved, Geno will use it automatically") : "Saved. Geno will use it automatically"); if (brand.name) kickoff(); } catch (e) { toast(e.message); }
}

/* ---------- memory ---------- */
async function openMemory() { try { memItems = (await api("/memory")).notes; openSide("memory"); } catch (e) { toast(e.message); } }
async function addMem() {
  try { const d = await api("/memory", { method: "POST", body: { title: $("#mt").value, text: $("#mx").value } }); memItems.unshift(d.note); renderSide(); toast(t("Saved")); }
  catch (e) { $("#merr").textContent = e.message; }
}
async function importMem(i) {
  const f = i.files[0]; if (!f) return;
  if (f.size > 200000) { toast("File too large (max 200 KB)"); return; }
  try { const d = await api("/memory", { method: "POST", body: { title: f.name, text: await f.text() } }); memItems.unshift(d.note); renderSide(); toast(t("Saved")); }
  catch (e) { toast(e.message); }
}
async function delMem(id) { try { await api("/memory/" + id, { method: "DELETE" }); memItems = memItems.filter(n => n.id !== id); renderSide(); } catch (e) { toast(e.message); } }

/* ---------- plans & manual payment ---------- */
function openPlans() {
  const p = $("#plans"), u = me.usage || { used: 0, limit: 0 };
  const sel = cfg.plans.find(x => x.id === planSel);
  const grid = `<div class="pgrid">${cfg.plans.map(x => `<button class="plan ${planSel === x.id ? "on" : ""}" onclick="planSel='${x.id}';openPlans()"><h4>${x.id[0].toUpperCase() + x.id.slice(1)}${me.plan === x.id ? " · " + t("Current") : ""}</h4><b>${x.price ? x.price + " " + cfg.currency + "/" + t("month") : "0"}</b><ul><li>${x.daily} ${t("messages per day")}</li></ul></button>`).join("")}</div>
    <button class="up" onclick="startPay()">${t("Upgrade now")}</button>`;
  const pay = sel ? `<div class="pay"><b>${sel.id.toUpperCase()} · ${sel.price} ${cfg.currency}</b>
    <p style="white-space:pre-wrap;font-size:12px">${cfg.payment.instructions ? esc(cfg.payment.instructions) : "Payment is not configured yet."}</p>
    <select id="pm">${cfg.payment.methods.map(m => `<option>${esc(m)}</option>`).join("")}</select>
    <input id="pr" placeholder="${t("Payment reference / transaction number")}">
    <button class="up" onclick="submitPay()" ${cfg.payment.instructions ? "" : "disabled"}>${t("I paid")}</button>
    <button class="mutb" onclick="payStep=false;openPlans()">${t("Back")}</button></div>` : "";
  p.innerHTML = `<div class="pcard"><button class="pexit" onclick="closePlans()">${t("Exit")}</button><button class="pback" onclick="closePlans()">${ic("back", 22)}</button><h2>${t("Plans")}</h2>
  <div class="usage">${t("Today")}: ${u.used}/${u.limit} ${t("messages")}</div>${payStep && sel ? pay : grid}</div>`;
  p.hidden = false;
}
function closePlans() { payStep = false; $("#plans").hidden = true; }
function startPay() {
  if (!planSel || planSel === "free" || planSel === me.plan) { toast(planSel === me.plan ? "This is your current plan" : "Choose Plus or Pro"); return; }
  payStep = true; openPlans();
}
async function submitPay() {
  try { await api("/payments", { method: "POST", body: { plan: planSel, method: $("#pm").value, reference: $("#pr").value } }); closePlans(); toast("Submitted. Your plan will be activated after we confirm the payment."); }
  catch (e) { toast(e.message); }
}

/* ---------- chat ---------- */
function newChat() { chatVer++; cur = null; msgs = []; files = []; renderStage(); renderTray(); renderSide(); closeSide(); }
async function openChat(id) {
  try { const d = await api("/chats/" + id); chatVer++; cur = id; msgs = d.messages.map(fromS); renderStage(); renderSide(); closeSide(); }
  catch (e) { toast(e.message); }
}
async function clearAll() { try { await api("/chats", { method: "DELETE" }); chatVer++; chats = []; cur = null; msgs = []; renderStage(); renderSide(); } catch (e) { toast(e.message); } }
function msgHTML(m, i) {
  const u = m.r === "u";
  const media = !m.text && m.type !== "voice" && (m.files || []).some(f => f.url && (f.img || f.vid));
  let body = "";
  (m.files || []).forEach(f => { body += f.vid && f.url ? `<div class="vid" onclick="togVid(this)"><video src="${f.url}" playsinline preload="metadata"></video><span class="pb">${ic("play", 24)}</span></div>` : f.img && f.url ? `<img src="${f.url}">` : `<span class="chip">${esc(f.name)}</span>`; });
  if (m.type === "voice") body += `<div class="vb"><button class="pl" onclick="play(${i})">${ic("play", 22)}</button><div class="wv">${(m.bars || []).map(v => `<i style="height:${Math.max(12, v * 100)}%"></i>`).join("")}</div></div>`;
  else if (m.text) body += esc(m.text);
  return `<div class="row ${u ? "u" : "b"}">${u ? "" : BOT}<div class="bub ${media ? "media" : ""}">${body}</div>${u ? avatarHTML("av") : ""}</div>`;
}
function renderStage() {
  const st = $("#stage"), empty = !msgs.length && !pending;
  $(".shell").classList.toggle("empty", empty);
  st.innerHTML = empty ? `<div class="wel">${LOGO(230)}<div class="wt">${t("welcome")}</div></div>`
    : msgs.map(msgHTML).join("") + (pending ? `<div class="row b">${BOT}<div class="bub">…</div></div>` : "") + (!pending && brand.name && S.mode === "mk_exec" && msgs.length && msgs[msgs.length - 1].r === "b" ? execChips() : "");
  st.scrollTop = st.scrollHeight;
}
async function submit(o) {
  const ver = chatVer, fl = files; files = []; renderTray();
  msgs.push({ r: "u", type: o.type || "text", text: o.text || "", bars: o.bars || null, url: o.audio ? URL.createObjectURL(o.audio) : null, files: fl.map(f => ({ name: f.name, img: f.img, vid: f.vid, url: f.url })) });
  pending = true; renderStage();
  const fd = new FormData();
  if (cur) fd.append("chatId", cur);
  fd.append("text", o.text || ""); fd.append("type", o.type || "text");
  fd.append("lang", S.spoken === "auto" ? S.lang : S.spoken); fd.append("mode", S.mode); fd.append("dialect", S.dialect); fd.append("persona", S.persona);
  if (o.bars) fd.append("bars", JSON.stringify(o.bars));
  if (o.audio) fd.append("audio", o.audio, "voice.webm");
  fl.forEach(f => fd.append("files", f.file));
  let d = null, err = null;
  try { d = await api("/chat", { method: "POST", body: fd }); } catch (e) { err = e; }
  pending = false;
  if (d && !chats.some(c => c.id === d.chatId)) chats.unshift({ id: d.chatId, title: d.title });
  if (ver === chatVer) {
    if (d) { cur = d.chatId; me.usage = d.usage; msgs[msgs.length - 1] = fromS(d.user); msgs.push(fromS(d.bot)); if (d.bot.type === "voice" || S.mode === "tutor") speak(d.bot.text); }
    else msgs.push({ r: "b", type: "text", text: "⚠ " + err.message });
  }
  renderStage(); refreshSide();
}
function sendText() {
  if (pending) return;
  const inp = $("#inp"), tx = inp.value.trim();
  if (!tx && !files.length) return;
  inp.value = ""; submit({ text: tx });
}
function renderBar() {
  const b = $("#bar");
  if (recording) {
    b.className = "bar rec";
    b.innerHTML = `<button class="cx" onclick="cancelRec()">${ic("x", 18)}</button><div class="live" id="live"></div><button class="cs" onclick="sendVoice()">${ic("send", 20)}</button>`;
    return;
  }
  b.className = "bar";
  b.innerHTML = `<input id="inp" placeholder="${t("Message Geno…")}" autocomplete="off" oninput="syncBtns()" onkeydown="if(event.key==='Enter')sendText()"><button class="bi" onclick="document.getElementById('fi').click()">${ic("upload", 20)}</button><button class="bi" id="bm" onclick="startRec()">${ic("mic", 20)}</button><button class="bi" id="bs" onclick="sendText()" hidden>${ic("send", 20)}</button><input id="fi" type="file" multiple hidden onchange="addFiles(this)">`;
  syncBtns();
}
function syncBtns() { const has = ($("#inp") && $("#inp").value.trim()) || files.length; $("#bm").hidden = !!has; $("#bs").hidden = !has; }
function addFiles(i) {
  [...i.files].forEach(f => files.push({ file: f, name: f.name, img: f.type.startsWith("image/"), vid: f.type.startsWith("video/"), url: URL.createObjectURL(f) }));
  i.value = ""; renderTray();
}
function rmFile(i) { files.splice(i, 1); renderTray(); }
function renderTray() {
  const tr = $("#tray");
  tr.innerHTML = files.map((f, i) => `<div class="ti" title="Remove" onclick="rmFile(${i})">${f.img ? `<img src="${f.url}">` : `<span class="fi">${ic("file", 22)}</span>`}<span class="tn">${esc(f.name)}</span></div>`).join("");
  tr.hidden = !files.length;
  if ($("#bm")) syncBtns();
}

/* ---------- voice (record + browser speech-to-text) ---------- */
async function startRec() {
  recBars = []; chunks = []; transcript = ""; mr = null; an = null; rc = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) { toast("Microphone is not available"); return; }
  try {
    mr = new MediaRecorder(stream); mr.ondataavailable = e => chunks.push(e.data); mr.start();
    ac = new (window.AudioContext || window.webkitAudioContext)();
    an = ac.createAnalyser(); an.fftSize = 256; ac.createMediaStreamSource(stream).connect(an);
  } catch (e) {}
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && !cfg.stt) {
    rc = new SR(); rc.continuous = true; rc.interimResults = false;
    rc.lang = (S.spoken === "auto" ? S.lang : S.spoken) === "ar" ? "ar-EG" : "en-US";
    rc.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " "; };
    try { rc.start(); } catch (e) { rc = null; }
  }
  recording = true; renderBar();
  tick = setInterval(() => {
    let l = .1;
    if (an) { const d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); let m = 0; d.forEach(v => m = Math.max(m, Math.abs(v - 128))); l = Math.min(1, m / 90 + .05); }
    recBars.push(l);
    const lv = $("#live"); if (lv) lv.innerHTML = recBars.slice(-60).map(v => `<i style="height:${Math.max(8, v * 100)}%"></i>`).join("");
  }, 80);
}
function stopAll() { clearInterval(tick); try { if (rc) rc.stop(); } catch (e) {} if (stream) stream.getTracks().forEach(x => x.stop()); if (ac) ac.close().catch(() => {}); stream = ac = an = rc = null; }
function cancelRec() { if (mr && mr.state !== "inactive") { mr.onstop = null; mr.stop(); } stopAll(); recording = false; renderBar(); }
async function sendVoice() {
  const n = 36, bars = Array.from({ length: n }, (_, i) => recBars.length ? +recBars[Math.floor(i * recBars.length / n)].toFixed(2) : .3);
  try { if (rc) rc.stop(); } catch (e) {}
  await sleep(700);
  const blob = await new Promise(res => { if (mr && mr.state !== "inactive") { mr.onstop = () => res(new Blob(chunks, { type: mr.mimeType })); mr.stop(); } else res(null); });
  stopAll(); recording = false; renderBar();
  let text = transcript.trim();
  if (cfg.stt && blob) {
    try { const fd = new FormData(); fd.append("audio", blob, "voice.webm"); fd.append("lang", S.spoken === "auto" ? "" : S.spoken); text = (await api("/transcribe", { method: "POST", body: fd })).text.trim(); }
    catch (e) { toast(e.message); }
  }
  if (!text) { toast("Could not transcribe your voice. Speech-to-text needs Chrome, Edge or Safari. You can type instead."); return; }
  submit({ text, type: "voice", bars, audio: blob });
}
function speak(text) {
  if (!window.speechSynthesis || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = S.spoken === "auto" ? (/[\u0600-\u06FF]/.test(text) ? "ar" : "en") : S.spoken;
  speechSynthesis.speak(u);
}
function play(i) {
  const m = msgs[i]; stopPlay();
  if (m.url) { aud = new Audio(m.url); aud.play(); } else speak(m.text);
}
function stopPlay() { if (aud) { aud.pause(); aud = null; } if (window.speechSynthesis) speechSynthesis.cancel(); }
function togVid(el) { const v = el.firstChild; if (v.paused) { v.play(); el.classList.add("go"); v.onended = () => el.classList.remove("go"); } else { v.pause(); el.classList.remove("go"); } }

/* ---------- start ---------- */
(async function boot() {
  applyS();
  try { cfg = await (await fetch("/api/config")).json(); } catch (e) {}
  if (token) {
    try { me = (await api("/me")).user; chats = (await api("/chats")).chats; try { brand = (await api("/brand")).brand; } catch (e) {} renderApp(); return; }
    catch (e) { token = null; ls.set("geno_token", null); }
  }
  renderAuth("login");
})();
