// ElevenLabs TTS — synthesizes Mickey's reply audio and serves it from this
// server's /audio static route (see server.js).

const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// "Liam" — energetic, confident young American voice; closest premade match
// to a fast-talking Hollywood talent scout. Override per-NPC via env if more
// voices are cast later.
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || "TX3LPaxmHKxFdv7VOQHJ";

const AUDIO_DIR = path.join(__dirname, "..", "..", "public", "audio");

async function synthesizeSpeech(text, npcId, requestBaseUrl) {
  const voiceId = process.env[`ELEVENLABS_VOICE_ID_${npcId.toUpperCase()}`] || DEFAULT_VOICE_ID;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${body}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const fileName = `${npcId}-${randomUUID()}.mp3`;
  await fs.writeFile(path.join(AUDIO_DIR, fileName), audioBuffer);

  // PUBLIC_BASE_URL is only for forcing a specific public host (production,
  // tunnels); local/LAN dev derives it from the request the phone already
  // reached us on, so there's no IP to keep hand-synced with the network.
  const baseUrl = process.env.PUBLIC_BASE_URL || requestBaseUrl;
  return `${baseUrl}/audio/${fileName}`;
}

module.exports = { synthesizeSpeech };
