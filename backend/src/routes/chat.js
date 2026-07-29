const express = require("express");
const multer = require("multer");

const { transcribeAudio } = require("../services/whisper");
const { evaluateQuestTurn } = require("../services/llm");
const { synthesizeSpeech } = require("../services/elevenlabs");
const {
  getUserQuestState,
  updateUserQuestState,
  saveConversationTurn,
  recordVocabulary,
  incrementUserXp,
} = require("../services/supabase");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// XP awarded when the player answers correctly (objective_completed).
const QUEST_COMPLETION_XP = 100;
// XP required to advance one estimated_level tier.
const XP_PER_LEVEL = 750;
// Struggle Drop: after this many consecutive failed objectives, back off the
// player's estimated_level by one tier and reset the streak.
const MAX_CONSECUTIVE_FAILS = 3;
const MIN_ESTIMATED_LEVEL = 1;
const MAX_ESTIMATED_LEVEL = 10;

// Guarantees next_task_text reads as an unambiguous instruction even if the
// model drifts from the "Task: " prefix mandated in the system prompt —
// OpenAI's strict structured-outputs mode enforces types/required/enum, not
// string content, so this is a deterministic safety net rather than trusting
// the model alone.
function normalizeTaskText(taskText) {
  return /^task:\s/i.test(taskText) ? taskText : `Task: ${taskText}`;
}

// POST /api/chat
// multipart/form-data: user_id, npc_id, audio_file, fluency_delay_seconds
router.post("/chat", upload.single("audio_file"), async (req, res) => {
  const { user_id, npc_id } = req.body;
  const fluency_delay_seconds = Number(req.body.fluency_delay_seconds);
  const audioFile = req.file;

  if (!user_id || !npc_id || !audioFile) {
    return res.status(400).json({
      error: "user_id, npc_id, and audio_file are all required.",
    });
  }

  try {
    // Dynamic Quest Engine: pull full user state up front so it can be
    // validated/logged before it starts feeding the LLM prompt in a later step.
    const userState = await getUserQuestState(user_id);

    if (!userState) {
      return res.status(400).json({ error: `User ${user_id} not found.` });
    }

    console.log("User State:", {
      userId: user_id,
      npcId: npc_id,
      fluencyDelaySeconds: fluency_delay_seconds,
      xp: userState.xp,
      estimatedLevel: userState.estimatedLevel,
      isCalibrated: userState.isCalibrated,
      currentTask: userState.currentTask,
      vocabularyWordCount: userState.vocabularyWords.length,
    });

    const transcript = await transcribeAudio(audioFile.buffer, audioFile.mimetype);

    // Struggle Drop: if this attempt fails too, it'll be the 3rd consecutive
    // fail — tell the LLM up front so it generates a fresh, easier task
    // instead of repeating the one that just tripped the player up.
    const isFinalStruggleAttempt = userState.consecutiveFails + 1 >= MAX_CONSECUTIVE_FAILS;

    const evaluation = await evaluateQuestTurn({
      transcript,
      estimatedLevel: userState.estimatedLevel,
      isCalibrated: userState.isCalibrated,
      currentTask: userState.currentTask,
      fluencyDelaySeconds: fluency_delay_seconds,
      vocabularyWords: userState.vocabularyWords,
      isFinalStruggleAttempt,
    });

    console.log("AI Evaluation:", evaluation);

    const {
      npc_reply_text,
      objective_completed,
      needs_subtle_hint,
      suggested_level,
      confidence_in_level,
      new_vocab_detected,
    } = evaluation;
    const next_task_text = normalizeTaskText(evaluation.next_task_text);

    console.log("New vocab detected:", new_vocab_detected);

    const requestBaseUrl = `${req.protocol}://${req.get("host")}`;
    const npc_audio_url = await synthesizeSpeech(npc_reply_text, npc_id, requestBaseUrl);

    await saveConversationTurn({ userId: user_id, npcId: npc_id, transcript, npcReplyText: npc_reply_text });

    if (new_vocab_detected.length > 0) {
      recordVocabulary({ userId: user_id, words: new_vocab_detected }).catch((err) => {
        console.error("recordVocabulary failed (non-fatal):", err);
      });
    }

    // Dynamic Quest Engine, Step 3: persist progression/calibration/
    // struggle-drop state ahead of responding, per CLAUDE.md's rules.
    const questStateUpdates = {};
    let show_level_unlocked;
    let newXpTotal;

    if (objective_completed) {
      questStateUpdates.current_task = next_task_text;
      questStateUpdates.consecutive_fails = 0;

      try {
        newXpTotal = await incrementUserXp(user_id, QUEST_COMPLETION_XP);
      } catch (err) {
        console.error("incrementUserXp failed (non-fatal):", err);
      }
    } else {
      const newConsecutiveFails = userState.consecutiveFails + 1;
      if (newConsecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        questStateUpdates.consecutive_fails = 0;
        questStateUpdates.estimated_level = Math.max(
          MIN_ESTIMATED_LEVEL,
          userState.estimatedLevel - 1
        );
        // isFinalStruggleAttempt told the LLM to invent a new, easier task
        // for this exact turn — persist it instead of leaving the player
        // stuck on the task that just got them demoted.
        questStateUpdates.current_task = next_task_text;
      } else {
        questStateUpdates.consecutive_fails = newConsecutiveFails;
      }
    }

    if (newXpTotal !== undefined && newXpTotal >= XP_PER_LEVEL) {
      await incrementUserXp(user_id, -XP_PER_LEVEL);

      if (userState.estimatedLevel < MAX_ESTIMATED_LEVEL) {
        const newLevel = Math.min(MAX_ESTIMATED_LEVEL, userState.estimatedLevel + 1);
        questStateUpdates.estimated_level = newLevel;
        show_level_unlocked = newLevel;
      }
    }

    if (!userState.isCalibrated && confidence_in_level === "high") {
      questStateUpdates.is_calibrated = true;
      questStateUpdates.estimated_level = suggested_level;
      show_level_unlocked = suggested_level;
    }

    if (Object.keys(questStateUpdates).length > 0) {
      await updateUserQuestState(user_id, questStateUpdates);
    }

    const responsePayload = {
      transcript,
      npc_reply_text,
      npc_audio_url,
      new_vocab_detected,
      objective_completed,
      needs_subtle_hint,
      next_task_text,
    };

    if (show_level_unlocked !== undefined) {
      responsePayload.show_level_unlocked = show_level_unlocked;
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error("POST /api/chat failed:", err);
    return res.status(500).json({ error: "Failed to process chat turn." });
  }
});

module.exports = router;
