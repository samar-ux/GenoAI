// Privacy policy, terms and data-deletion pages (Meta also requires a privacy URL and a data-deletion URL for app review).
// These are TEMPLATES: set COMPANY_NAME and CONTACT_EMAIL, and have a lawyer review them before launch.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const co = () => esc(process.env.COMPANY_NAME || "Geno AI"), mail = () => esc(process.env.CONTACT_EMAIL || "[set CONTACT_EMAIL]");
const page = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - ${co()}</title>
<style>body{font:16px/1.65 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px;color:#222}h1{font-size:26px}h2{font-size:18px;margin-top:28px}.ar{direction:rtl;border-top:1px solid #ddd;margin-top:36px;padding-top:8px}a{color:#0a7ad8}</style></head><body>${body}</body></html>`;

const privacy = () => page("Privacy Policy", `<h1>Privacy Policy</h1><p>Last updated: ${new Date().toISOString().slice(0, 10)}. ${co()} ("we") runs the Geno AI service. Contact: ${mail()}.</p>
<h2>Data we store</h2><p>Your username and a hashed password; your chats, uploaded files and voice messages; the brand profile and notes you save; the marketing plan and tasks; and, if you connect channels, your Facebook Page, Telegram or Meta Ads identifiers and access tokens (stored encrypted, never shown again).</p>
<h2>How we use it</h2><p>To provide the service. Your messages, files and brand profile are sent to our AI provider (Anthropic) to generate replies. Posts and ads are sent to Facebook, Telegram or Meta only when you press Run or approve a task. We do not sell your data and do not use it for advertising.</p>
<h2>Social platform data</h2><p>We use the permissions you grant only to publish the content you approve and to read the performance of what we published for you. You can disconnect a channel at any time in the plan screen, and revoke access in your Facebook settings.</p>
<h2>Retention and deletion</h2><p>You can export or permanently delete your account and all its data from the Account screen. See <a href="/data-deletion">data deletion</a>. Encrypted backups of the database are kept for up to 7 days.</p>
<h2>Security</h2><p>Passwords are hashed, access tokens are encrypted at rest, and traffic is sent over HTTPS. No system is perfectly secure.</p>
<h2>Contact</h2><p>${mail()}</p>
<div class="ar"><h1>سياسة الخصوصية</h1><p>نخزّن اسم المستخدم وكلمة مرور مشفرة، ومحادثاتك وملفاتك، وبيانات البراند والخطة، وبيانات ربط القنوات (التوكنات مشفرة). تُرسل رسائلك وبيانات البراند إلى مزود الذكاء الاصطناعي لتوليد الردود، ولا يُنشر شيء على فيسبوك أو تيليجرام أو ميتا إلا بعد ضغطك "نفّذ" أو اعتمادك للمهمة. لا نبيع بياناتك. يمكنك تصدير بياناتك أو حذف حسابك نهائياً من شاشة الحساب. للتواصل: ${mail()}</p></div>`);

const terms = () => page("Terms of Service", `<h1>Terms of Service</h1><p>By using Geno AI, operated by ${co()}, you agree to these terms.</p>
<h2>The service</h2><p>Geno generates marketing content and plans with AI and, when you connect channels, publishes the content you approve. AI output can contain mistakes: you are responsible for reviewing everything before you publish, and for the accuracy and legality of what you publish and advertise.</p>
<h2>Your responsibilities</h2><p>You must have the right to use the accounts you connect, follow the rules of each platform (Meta, Telegram), and applicable advertising and consumer laws. Ads are created paused; you decide when to activate them and what you spend. We do not guarantee any marketing result.</p>
<h2>Acceptable use</h2><p>No spam, deception, illegal or harmful content. We may suspend accounts that break these rules.</p>
<h2>Plans and payments</h2><p>Paid plans are paid manually as described in the app and are not refundable unless required by law.</p>
<h2>Liability</h2><p>The service is provided "as is". To the extent permitted by law, ${co()} is not liable for indirect losses, lost profit or ad spend.</p>
<h2>Contact</h2><p>${mail()}</p>
<div class="ar"><h1>شروط الاستخدام</h1><p>Geno يولّد محتوى وخططاً تسويقية بالذكاء الاصطناعي وينشر ما تعتمده فقط. قد يخطئ الذكاء الاصطناعي، وأنت المسؤول عن مراجعة كل شيء قبل النشر وعن قانونية ما تنشره وتعلن عنه والتزامك بقواعد المنصات. الإعلانات تُنشأ متوقفة وأنت تقرر تفعيلها وإنفاقها. لا نضمن أي نتيجة تسويقية. للتواصل: ${mail()}</p></div>`);

const deletion = () => page("Data deletion", `<h1>Data deletion</h1><p>To delete your data: log in, open <b>Account</b>, press <b>Delete my account</b> and confirm with your password. Your chats, files, brand profile, plan, tasks and stored channel tokens are erased immediately. Database backups holding your data are overwritten within 7 days.</p>
<p>You can also email ${mail()} from the address linked to your account and we will delete it for you.</p>
<p>To stop Geno accessing your Facebook Page or ad account, remove the app in Facebook Settings > Business Integrations, or press Disconnect in the Geno plan screen.</p>
<div class="ar"><h1>حذف البيانات</h1><p>سجّل الدخول ثم افتح "الحساب" واضغط "حذف حسابي" وأكّد بكلمة المرور، فتُمسح محادثاتك وملفاتك وبيانات البراند والخطة والتوكنات فوراً. ولإيقاف وصول Geno لصفحتك احذف التطبيق من إعدادات فيسبوك أو اضغط "فصل" في شاشة الخطة. أو راسلنا: ${mail()}</p></div>`);

module.exports = app => {
  const send = f => (req, res) => res.type("html").send(f());
  app.get("/privacy", send(privacy)); app.get("/terms", send(terms)); app.get("/data-deletion", send(deletion));
};
