// Supabase REST (PostgREST) access for the `users`, `conversations`, and
// `vocabulary_memory` tables described in CLAUDE.md.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The frontend falls back to this all-zero UUID when no real user is signed
// in yet (see PushToTalkButton.tsx / GameScreen.tsx). It must satisfy the
// same NOT NULL uuid column type as a real user, so a random slug like
// "demo-user" would fail with Postgres error 22P02 (invalid uuid syntax).
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

async function supabaseRequest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase request failed (${res.status} ${path}): ${body}`);
  }

  // 204 No Content, and 201 responses to `Prefer: return=minimal` writes,
  // both come back with an empty body — only parse when there's something to parse.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Creates the demo user row on first use so FK inserts in saveConversationTurn
// / recordVocabulary don't fail while there's no real auth/onboarding yet.
// No-ops for any other (real) user id.
async function ensureDemoUser(userId) {
  if (userId !== DEMO_USER_ID) return;

  const existing = await supabaseRequest(`users?id=eq.${DEMO_USER_ID}&select=id`);
  if (existing.length > 0) return;

  await supabaseRequest("users", {
    method: "POST",
    // ignore-duplicates makes this a no-op (instead of a 409) if another
    // request already created the row between our check and this insert.
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({
      id: DEMO_USER_ID,
      base_language: "en",
      target_language: "es",
      estimated_level: 1,
    }),
  });
}

// Fetches the user's estimated_level and known vocabulary words, used to
// inject {user.estimated_level} and {vocabulary_memory.words} into Mickey's
// system prompt per CLAUDE.md.
async function getUserContext(userId) {
  await ensureDemoUser(userId);

  const [users, vocab] = await Promise.all([
    supabaseRequest(`users?id=eq.${userId}&select=estimated_level`),
    supabaseRequest(
      `vocabulary_memory?user_id=eq.${userId}&select=word&order=encounter_count.desc&limit=50`
    ),
  ]);

  return {
    estimatedLevel: users[0]?.estimated_level ?? 1,
    vocabularyWords: vocab.map((row) => row.word),
  };
}

// Fetches full quest-engine user state (xp, level, calibration flag, active
// task) plus known vocabulary. Returns null if no user row exists for
// userId. Used by the /api/chat route to validate/log state ahead of the
// Dynamic Quest Engine's prompt-injection step.
async function getUserQuestState(userId) {
  await ensureDemoUser(userId);

  const [users, vocab] = await Promise.all([
    supabaseRequest(
      `users?id=eq.${userId}&select=xp,estimated_level,is_calibrated,current_task,consecutive_fails`
    ),
    supabaseRequest(
      `vocabulary_memory?user_id=eq.${userId}&select=word&order=encounter_count.desc&limit=50`
    ),
  ]);

  if (users.length === 0) return null;

  return {
    xp: users[0].xp,
    estimatedLevel: users[0].estimated_level,
    isCalibrated: users[0].is_calibrated,
    currentTask: users[0].current_task,
    consecutiveFails: users[0].consecutive_fails,
    vocabularyWords: vocab.map((row) => row.word),
  };
}

// Applies the Dynamic Quest Engine's per-turn progression writes (task
// advance, calibration, struggle-drop) to the users row in a single PATCH.
// XP goes through increment_user_xp() instead (see incrementUserXp) since it
// must stay atomic against the concurrent per-turn XP increment in chat.js.
async function updateUserQuestState(userId, updates) {
  await supabaseRequest(`users?id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(updates),
  });
}

// Persists one conversation turn (user transcript + Mickey's reply) as two
// rows in `conversations`.
async function saveConversationTurn({ userId, npcId, transcript, npcReplyText }) {
  await supabaseRequest("conversations", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([
      { user_id: userId, npc_id: npcId, role: "user", message_text: transcript },
      { user_id: userId, npc_id: npcId, role: "npc", message_text: npcReplyText },
    ]),
  });
}

// Upserts detected vocabulary: bumps encounter_count for words the user has
// already met, inserts a fresh row (encounter_count = 1) otherwise.
async function recordVocabulary({ userId, words }) {
  for (const word of words) {
    const existing = await supabaseRequest(
      `vocabulary_memory?user_id=eq.${userId}&word=eq.${encodeURIComponent(word)}&select=id,encounter_count`
    );

    if (existing.length > 0) {
      await supabaseRequest(`vocabulary_memory?id=eq.${existing[0].id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ encounter_count: existing[0].encounter_count + 1 }),
      });
    } else {
      await supabaseRequest("vocabulary_memory", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, word, encounter_count: 1 }),
      });
    }
  }
}

// Fetches the user's persisted XP total (used to initialize the frontend's
// XPProgressBar on mount).
async function getUserXp(userId) {
  await ensureDemoUser(userId);

  const users = await supabaseRequest(`users?id=eq.${userId}&select=xp`);
  return users[0]?.xp ?? 0;
}

// Atomically increments the user's XP via the increment_user_xp() RPC
// (see supabase/migrations/0002_add_users_xp.sql) so concurrent chat turns
// can't clobber each other the way a read-then-PATCH would.
async function incrementUserXp(userId, amount) {
  await ensureDemoUser(userId);

  return supabaseRequest("rpc/increment_user_xp", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_xp_amount: amount }),
  });
}

module.exports = {
  DEMO_USER_ID,
  getUserContext,
  getUserQuestState,
  updateUserQuestState,
  saveConversationTurn,
  recordVocabulary,
  getUserXp,
  incrementUserXp,
};
