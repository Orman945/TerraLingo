# Project: Language Metaverse MVP (Phase 1 - Hollywood Boulevard)

## Tech Stack
*   **Frontend:** React Native / Expo (Mobile First)
*   **Backend:** Node.js / Express (Proxy Layer for API Keys)
*   **Database:** Supabase (PostgreSQL with pgvector)
*   **AI/Audio APIs:** OpenAI (GPT-4o mini or Claude 3.5 Sonnet), ElevenLabs (TTS), Whisper (STT)

## Architectural Constraints
*   **Backend Isolation:** All LLM and API calls MUST happen in the Node.js backend to protect API keys. The Expo frontend only communicates with our backend proxy.
*   **Component Structure:** Strictly adhere to this tree for React Native:
    *   `/src/screens/GameScreen.tsx` (360 background container)
    *   `/src/components/NPCAvatar.tsx` 
    *   `/src/components/PushToTalkButton.tsx` (Handle idle, recording, processing states)
    *   `/src/components/TranscriptOverlay.tsx`
    *   `/src/services/api.ts`
*   **Database Schema:** Supabase tables (`users`, `conversations`, `vocabulary_memory`) must use UUIDs for primary keys. `vocabulary_memory` requires pgvector for embedding storage.

## API Data Contracts
*   **Endpoint:** `POST /api/chat`
*   **Request:** `multipart/form-data` with `user_id`, `npc_id`, `audio_file`.
*   **Response:** JSON exactly matching `{ transcript: string, npc_reply_text: string, npc_audio_url: string, new_vocab_detected: [string] }`

## Core AI & Legal Rules
*   **NPC Persona:** The AI is "Mickey," an exaggerated, fast-talking Hollywood talent scout. 
*   **Prompt Injection:** The system prompt must dynamically inject `{user.estimated_level}` and `{vocabulary_memory.words}` from the database before calling the LLM. Responses must be < 3 sentences and naturally correct grammar mistakes.
*   **Safety Restrictions:** STRICTLY sandbox the AI to prevent NSFW content. NEVER use real celebrity names or likenesses.