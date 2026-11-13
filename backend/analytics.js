// Exact campaign metrics from an uploaded CSV, so the model reasons over real numbers instead of doing arithmetic itself.
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const sep = [",", ";", "\t"].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
const key = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
const NAME_PRIORITY = ["adname", "ad", "creative", "creativename", "variant", "adsetname", "adset", "campaignname", "campaign", "name"];
const COLS = {
  spend: k => /^(spend|cost|amountspent)/.test(k),
  impressions: k => /^impressions?$/.test(k),
  clicks: k => /^(clicks|linkclicks)/.test(k),
  conversions: k => /^(conversions?|purchases?|results|leads|orders|actions)$/.test(k),
  revenue: k => /^(revenue|purchasevalue|conversionvalue|salesvalue|totalsales|sales|value)$/.test(k)
};
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
const phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
function twoProp(x1, n1, x2, n2) {
  if (n1 < 1 || n2 < 1) return null;
  const p = (x1 + x2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se ? 2 * (1 - phi(Math.abs((x1 / n1 - x2 / n2) / se))) : null;
}
const pct = v => (v * 100).toFixed(2) + "%";
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : "n/a");

function summarize(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return null;
  const head = rows[0].map(key), idx = {};
  for (const [m, test] of Object.entries(COLS)) { const i = head.findIndex(test); if (i >= 0) idx[m] = i; }
  let ni = -1; for (const n of NAME_PRIORITY) { ni = head.indexOf(n); if (ni >= 0) break; }
  if (ni < 0 || !(idx.spend !== undefined || idx.impressions !== undefined || idx.clicks !== undefined)) return null;

  const agg = new Map();
  for (const r of rows.slice(1)) {
    const name = (r[ni] || "").trim() || "(unnamed)";
    const a = agg.get(name) || { name, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    for (const m of Object.keys(idx)) a[m] += num(r[idx[m]]);
    agg.set(name, a);
  }
  const list = [...agg.values()].map(a => ({ ...a,
    ctr: a.impressions ? a.clicks / a.impressions : NaN, cpc: a.clicks ? a.spend / a.clicks : NaN,
    cvr: a.clicks ? a.conversions / a.clicks : NaN, cpa: a.conversions ? a.spend / a.conversions : NaN,
    roas: a.spend ? a.revenue / a.spend : NaN }));
  const has = m => idx[m] !== undefined;
  const rank = has("revenue") && has("spend") ? [x => x.roas, -1, "ROAS"] : has("conversions") && has("spend") ? [x => x.cpa, 1, "CPA"] : has("clicks") && has("impressions") ? [x => x.ctr, -1, "CTR"] : [x => x.spend, -1, "spend"];
  list.sort((a, b) => { const va = rank[0](a), vb = rank[0](b); return (Number.isFinite(va) ? 0 : 1) - (Number.isFinite(vb) ? 0 : 1) || rank[1] * (va - vb); });

  const T = list.reduce((t, a) => { for (const m of ["spend", "impressions", "clicks", "conversions", "revenue"]) t[m] += a[m]; return t; }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
  const out = [`Rows grouped by "${rows[0][ni].trim()}": ${list.length} items. Columns found: ${Object.keys(idx).join(", ")}. Ranked by ${rank[2]}.`,
    `Totals: spend ${f2(T.spend)}, impressions ${T.impressions}, clicks ${T.clicks}, conversions ${T.conversions}, revenue ${f2(T.revenue)}` +
    (T.impressions ? `, CTR ${pct(T.clicks / T.impressions)}` : "") + (T.clicks ? `, CVR ${pct(T.conversions / T.clicks)}, CPC ${f2(T.spend / T.clicks)}` : "") +
    (T.conversions ? `, CPA ${f2(T.spend / T.conversions)}` : "") + (T.spend && T.revenue ? `, ROAS ${f2(T.revenue / T.spend)}` : "") + "."];
  out.push("name | spend | impr | clicks | conv | CTR | CVR | CPA | ROAS | note");
  for (const a of list.slice(0, 15))
    out.push([a.name.slice(0, 40), f2(a.spend), a.impressions, a.clicks, a.conversions, Number.isFinite(a.ctr) ? pct(a.ctr) : "n/a", Number.isFinite(a.cvr) ? pct(a.cvr) : "n/a", f2(a.cpa), f2(a.roas), a.clicks < 100 ? "low data (<100 clicks)" : ""].join(" | "));
  if (list.length > 15) out.push(`(${list.length - 15} more rows not shown)`);

  if (list.length >= 2) {
    const [a, b] = list;
    const tests = [];
    if (has("impressions") && has("clicks")) { const p = twoProp(a.clicks, a.impressions, b.clicks, b.impressions); if (p !== null) tests.push(`CTR ${pct(a.ctr)} vs ${pct(b.ctr)} (p=${p.toFixed(3)}, ${p < 0.05 ? "likely a real difference" : "not conclusive"})`); }
    if (has("clicks") && has("conversions")) { const p = twoProp(a.conversions, a.clicks, b.conversions, b.clicks); if (p !== null) tests.push(`CVR ${pct(a.cvr)} vs ${pct(b.cvr)} (p=${p.toFixed(3)}, ${p < 0.05 ? "likely a real difference" : "not conclusive"})`); }
    if (tests.length) out.push(`Top two ("${a.name}" vs "${b.name}") two-proportion z-test: ` + tests.join("; ") + ". Treat p>=0.05 as not enough data to call a winner; very small samples are unreliable even when p is low.");
  }
  return out.join("\n").slice(0, 6000);
}
module.exports = { summarize, parseCSV };
