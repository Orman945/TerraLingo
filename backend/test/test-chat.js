// Quick smoke test: boots the server, POSTs a fake audio file to
// /api/chat, and checks the response matches the Data Contract exactly:
// { transcript: string, npc_reply_text: string, npc_audio_url: string, new_vocab_detected: [string] }
const { spawn } = require("child_process");
const path = require("path");
const FormData = require("form-data");

const PORT = 3999;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start in time")), 10000);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("listening on port")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`Server exited early with code ${code}`));
    });
  });
}

function assertSchema(body) {
  const errors = [];

  const expectedKeys = ["transcript", "npc_reply_text", "npc_audio_url", "new_vocab_detected"];
  const actualKeys = Object.keys(body).sort();
  const missing = expectedKeys.filter((k) => !actualKeys.includes(k));
  const extra = actualKeys.filter((k) => !expectedKeys.includes(k));
  if (missing.length) errors.push(`Missing keys: ${missing.join(", ")}`);
  if (extra.length) errors.push(`Unexpected extra keys: ${extra.join(", ")}`);

  if (typeof body.transcript !== "string") errors.push("transcript must be a string");
  if (typeof body.npc_reply_text !== "string") errors.push("npc_reply_text must be a string");
  if (typeof body.npc_audio_url !== "string") errors.push("npc_audio_url must be a string");
  if (!Array.isArray(body.new_vocab_detected) || !body.new_vocab_detected.every((v) => typeof v === "string")) {
    errors.push("new_vocab_detected must be an array of strings");
  }

  return errors;
}

async function main() {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "src", "server.js")], {
    env: { ...process.env, PORT: String(PORT) },
  });

  try {
    await waitForServer(child);

    const form = new FormData();
    form.append("user_id", "11111111-1111-1111-1111-111111111111");
    form.append("npc_id", "mickey");
    form.append("audio_file", Buffer.from("fake audio bytes"), {
      filename: "clip.wav",
      contentType: "audio/wav",
    });

    // Use a Buffer body instead of streaming `form` directly — undici's
    // fetch has flaky interop with form-data's legacy stream interface.
    const bodyBuffer = form.getBuffer();
    const response = await fetch(`http://localhost:${PORT}/api/chat`, {
      method: "POST",
      body: bodyBuffer,
      headers: {
        ...form.getHeaders(),
        "Content-Length": String(bodyBuffer.length),
      },
    });

    const body = await response.json();

    console.log(`Status: ${response.status}`);
    console.log("Response body:", JSON.stringify(body, null, 2));

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    const errors = assertSchema(body);
    if (errors.length) {
      console.error("\nSchema validation FAILED:");
      errors.forEach((e) => console.error(` - ${e}`));
      process.exitCode = 1;
    } else {
      console.log("\nSchema validation PASSED — response matches the Data Contract exactly.");
    }
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error("Test script failed:", err);
  process.exitCode = 1;
});
