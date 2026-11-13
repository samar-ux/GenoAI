// Optional server-side speech-to-text (OpenAI transcription API). Without OPENAI_API_KEY the app uses the browser's Web Speech API.
const enabled = () => !!process.env.OPENAI_API_KEY;

async function transcribe(buffer, filename, lang) {
  if (!enabled()) return null;
  const fd = new FormData();
  fd.append("file", new Blob([buffer]), filename);
  fd.append("model", process.env.STT_MODEL || "whisper-1");
  if (lang) fd.append("language", lang);
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY }, body: fd });
  if (!r.ok) throw new Error("Speech-to-text failed (" + r.status + ")");
  return ((await r.json()).text || "").trim();
}
module.exports = { enabled, transcribe };
