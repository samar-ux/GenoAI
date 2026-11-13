const db = require("./db");

const PLANS = {
  free: { daily: Number(process.env.FREE_DAILY) || 50, price: 0 },
  plus: { daily: Number(process.env.PLUS_DAILY) || 200, price: Number(process.env.PRICE_PLUS) || 99 },
  pro: { daily: Number(process.env.PRO_DAILY) || 2000, price: Number(process.env.PRICE_PRO) || 199 }
};
const CURRENCY = process.env.CURRENCY || "EGP";

function effectivePlan(u) {
  if (u.plan !== "free" && u.plan_until && u.plan_until < new Date().toISOString()) return "free";
  return u.plan;
}
function usage(u) {
  const used = db.prepare("SELECT COUNT(*) AS n FROM messages m JOIN chats c ON c.id = m.chat_id WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= date('now')").get(u.id).n;
  return { used, limit: PLANS[effectivePlan(u)].daily };
}
module.exports = { PLANS, CURRENCY, effectivePlan, usage };
