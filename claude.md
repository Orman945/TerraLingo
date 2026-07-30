# Project: Language Metaverse MVP (Phase 1 - Hollywood Boulevard)

## Tech Stack
*   **Frontend:** React Native / Expo SDK 57 (Mobile First). Use `expo-audio` (STRICTLY NO `expo-av`).
*   **Backend:** Node.js / Express (Proxy Layer for API Keys)
*   **Database:** Supabase (PostgreSQL with pgvector)
*   **AI/Audio APIs:** OpenAI GPT-4o mini (NPC dialogue, Structured Outputs) + Whisper (STT), ElevenLabs (TTS)

## Architectural Constraints
*   **Backend Isolation:** All LLM and API calls MUST happen in the Node.js backend to protect API keys. The Expo frontend only communicates with our backend proxy.
*   **Component Structure:** Strictly adhere to this tree for React Native:
    *   `/src/screens/GameScreen.tsx` (Main layout, handles fluency stopwatch)
    *   `/src/components/Environment360Viewer.tsx` (Handles interactive 360-degree pano tiles)
    *   `/src/components/NPCAvatar.tsx` 
    *   `/src/components/PushToTalkButton.tsx` (Handle idle, recording, processing states)
    *   `/src/components/TranscriptOverlay.tsx`
    *   `/src/components/XPProgressBar.tsx` (Animated local progression UI)
    *   `/src/components/LevelUpNotification.tsx` (Celebratory UI for calibration/level ups)
    *   `/src/services/api.ts`
*   **Database Schema:** Supabase tables (`users`, `conversations`, `vocabulary_memory`) use UUIDs for primary keys. 
    *   `users` table includes: `xp` (int, default 0), `estimated_level` (int, 1-10, default 1), `is_calibrated` (bool, default false), and `current_task` (text).
    *   *Note: There is NO static quests table. Quests are generated dynamically.*
*   **360 Viewer:** `Environment360Viewer` renders panoramas via Photo Sphere Viewer (three.js) run inside a `WebView` (native) / sandboxed `<iframe>` (web). Do NOT use `expo-gl` + `@react-three/fiber`. The web iframe's `sandbox` MUST include `allow-same-origin` alongside `allow-scripts`.

## API Data Contracts
*   **Endpoint:** `POST /api/chat`
*   **Request (`multipart/form-data`):** 
    *   `user_id` (UUID)
    *   `npc_id` (string)
    *   `audio_file` (Blob/File)
    *   `fluency_delay_seconds` (number) - The time elapsed between the NPC finishing audio and the user starting their recording.
*   **Response (JSON from Express to Frontend):** 
    `{ 
      transcript: string, 
      npc_reply_text: string, 
      npc_audio_url: string, 
      new_vocab_detected: [string], 
      objective_completed: boolean, 
      needs_subtle_hint: boolean,
      next_task_text: string,
      show_level_unlocked: number | null
    }`

## The Dynamic Quest Engine (LLM Structured Output)
The Node.js backend must enforce OpenAI Structured Outputs (`json_schema` strict mode). The LLM output MUST include:
*   `objective_completed` (boolean)
*   `needs_subtle_hint` (boolean)
*   `next_task_text` (string - A short, UI-friendly sentence of the next objective, e.g., "Task: Describe the car using two words.")
*   `suggested_level` (integer 1-10)
*   `confidence_in_level` (enum: "low", "medium", "high")

## 🧠 The 10-Level Curriculum: Formulaic Chunks & Calibration Rules
The backend system prompt must dynamically inject `{user.estimated_level}`, `{user.vocabulary_memory}`, `{user.current_task}`, and the `fluency_delay_seconds`. 
*   **Calibration:** If `is_calibrated` is false, the LLM must evaluate the user's grammar complexity and speed (`fluency_delay_seconds`). If a Level 1 user speaks rapid, complex sentences, the LLM must output a higher `suggested_level` (e.g., 4) and "high" `confidence_in_level`.

**Pedagogical Rule:** Never ask the user to say a single, isolated word (e.g., "Say 'movie'"). The brain cannot retain naked vocabulary. Always use "Formulaic Chunks" (short, practical sentence frames).

When generating `next_task_text`, the AI must formulate the task based on the user's `estimated_level` using the following curriculum:

*   **Level 1 (The Parrot):** Echoing full, short sentences. Give the user the exact 3-4 word phrase they need to say.
    *   *Example Task:* Say "I want a script."
*   **Level 2 (The Mad Libs):** Anchor frame + vocabulary swap. Keep the verb the same as Level 1, but ask them to swap the noun. 
    *   *Example Task:* Use "I want" + a monster.
*   **Level 3 (The React):** Contextual binary. Force listening comprehension by asking them to agree or disagree with the NPC using a full short sentence.
    *   *Example Task:* Reject Mickey's idea! Say "No, that is bad."
*   **Level 4 (The Stacker):** Noun + Adjective. Expand the phrase by adding descriptive words.
    *   *Example Task:* Describe the actor. Say "A very tall man."
*   **Level 5 (The Pivot):** Verb swapping. Introduce a new core verb using vocabulary they already know.
    *   *Example Task:* Tell Mickey you *have* the script. Say "I have the script."
*   **Level 6 (Time & Place):** Add spatial or temporal awareness to known sentences.
    *   *Example Task:* Tell Mickey you need the camera *now*. 
*   **Level 7 (The Questioner):** Reverse the dynamic. Force the user to ask the NPC a question.
    *   *Example Task:* Ask Mickey where the actor is.
*   **Level 8 (Emotional State):** Expressing feelings or opinions about the context.
    *   *Example Task:* Tell Mickey you are angry about the lighting.
*   **Level 9 (The Bridge):** Connecting two thoughts with conjunctions (and, but, because).
    *   *Example Task:* Say you want the dragon, *but* it is too big.
*   **Level 10 (Improv):** Total freedom. Give a contextual goal without providing the exact words.
    *   *Example Task:* Explain to Mickey why his movie ending is terrible in your own words.

**Output Formatting:** The generated `next_task_text` must be short, punchy, and formatted perfectly for the UI's Director's HUD.

*   **Task Generation:** If `objective_completed` is true, the LLM must generate a NEW `next_task_text` adhering strictly to the user's current level rules without repeating past vocabulary.

## Core AI & Gameplay Rules
*   **NPC Persona:** "Mickey," an exaggerated, fast-talking Hollywood talent scout. MVP is STRICTLY in English.
*   **Failing Forward:** Mickey never breaks character to correct grammar. He uses in-world context to provide hints if the user fails the objective.
*   **Struggle Drop:** If the backend detects 3 consecutive `objective_completed: false` results, the backend must automatically decrement the user's `estimated_level` by 1 and generate an easier task.
*   **Security:** NEVER hardcode API keys. Use `process.env`. Keep `.env` in `.gitignore`. STRICTLY sandbox AI to prevent NSFW content or real copyrighted celebrities.