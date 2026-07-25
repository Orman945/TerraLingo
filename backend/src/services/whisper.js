// OpenAI Whisper (STT) — transcribes the user's uploaded audio.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function extensionForMimeType(mimeType) {
  const map = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
  };
  return map[mimeType] || "wav";
}

async function transcribeAudio(audioBuffer, mimeType) {
  const form = new FormData();
  const fileName = `audio.${extensionForMimeType(mimeType)}`;
  form.append("file", new Blob([audioBuffer], { type: mimeType }), fileName);
  form.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Whisper transcription failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.text.trim();
}

module.exports = { transcribeAudio };
