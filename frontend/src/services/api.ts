/**
 * API service layer — talks only to our Node/Express backend proxy.
 * Per architectural constraints, the Expo app never calls LLM/TTS/STT
 * providers directly; all of that lives behind POST /api/chat.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export interface ChatResponse {
  transcript: string;
  npc_reply_text: string;
  npc_audio_url: string;
  new_vocab_detected: string[];
}

export async function sendChatAudio(
  userId: string,
  npcId: string,
  audioFile: Blob,
  fileName = "recording.m4a"
): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("npc_id", npcId);
  formData.append("audio_file", audioFile, fileName);

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchUserXp(userId: string): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/xp`);

  if (!response.ok) {
    throw new Error(`Fetch XP failed: ${response.status}`);
  }

  const data: { xp: number } = await response.json();
  return data.xp;
}
