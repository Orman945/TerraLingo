# Project: Language Metaverse MVP (Phase 1 - Hollywood Boulevard)

## Tech Stack
*   **Frontend:** React Native / Expo SDK 57 (Mobile First). Use `expo-audio` (STRICTLY NO `expo-av`).
*   **Backend:** Node.js / Express (Proxy Layer for API Keys)
*   **Database:** Supabase (PostgreSQL with pgvector)
*   **AI/Audio APIs:** OpenAI GPT-4o mini (NPC dialogue) + Whisper (STT), ElevenLabs (TTS)

## Architectural Constraints
*   **Backend Isolation:** All LLM and API calls MUST happen in the Node.js backend to protect API keys. The Expo frontend only communicates with our backend proxy.
*   **Component Structure:** Strictly adhere to this tree for React Native:
    *   `/src/screens/GameScreen.tsx` (Main layout)
    *   `/src/components/Environment360Viewer.tsx` (Handles interactive 360-degree pano tiles)
    *   `/src/components/NPCAvatar.tsx` 
    *   `/src/components/PushToTalkButton.tsx` (Handle idle, recording, processing states)
    *   `/src/components/TranscriptOverlay.tsx`
    *   `/src/services/api.ts`
*   **Database Schema:** Supabase tables (`users`, `conversations`, `vocabulary_memory`) must use UUIDs for primary keys. `vocabulary_memory` requires pgvector for embedding storage.
*   **360 Viewer:** `Environment360Viewer` renders panoramas via Photo Sphere Viewer (three.js) run inside a `WebView` (native) / sandboxed `<iframe>` (web) — `react-native-webview` has no web implementation, so the web path can't use it. Do NOT use `expo-gl` + `@react-three/fiber` instead: their `expo-gl` version pins mismatch on SDK 57 and break on physical devices. The web iframe's `sandbox` MUST include `allow-same-origin` alongside `allow-scripts` — without it the frame gets a null origin and WebGL context creation throws, which Photo Sphere Viewer swallows silently (looks like an infinite load/timeout, not a crash).

## API Data Contracts
*   **Endpoint:** `POST /api/chat`
*   **Request:** `multipart/form-data` with `user_id`, `npc_id`, `audio_file`.
*   **Response:** JSON exactly matching `{ transcript: string, npc_reply_text: string, npc_audio_url: string, new_vocab_detected: [string] }`

## Core AI & Legal Rules
*   **NPC Persona:** The AI is "Mickey," an exaggerated, fast-talking Hollywood talent scout. 
*   **Prompt Injection:** The system prompt must dynamically inject `{user.estimated_level}` and `{vocabulary_memory.words}` from the database before calling the LLM. Responses must be < 3 sentences and naturally correct grammar mistakes.
*   **Safety Restrictions:** STRICTLY sandbox the AI to prevent NSFW content. NEVER use real celebrity names or likenesses.
*   **Security:** NEVER hardcode API keys in the frontend or backend code. Always use `process.env` and ensure `.env` remains in `.gitignore`.