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

// XP awarded per completed chat turn (transcribed, replied to, and voiced).
const XP_PER_CHAT_TURN = 50;
// XP bonus for completing the active quest objective.
const QUEST_COMPLETION_XP = 150;
// Struggle Drop: after this many consecutive failed objectives, back off the
// player's estimated_level by one tier and reset the streak.
const MAX_CONSECUTIVE_FAILS = 3;
const MIN_ESTIMATED_LEVEL = 1;

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

    const evaluation = await evaluateQuestTurn({
      transcript,
      estimatedLevel: userState.estimatedLevel,
      isCalibrated: userState.isCalibrated,
      currentTask: userState.currentTask,
      fluencyDelaySeconds: fluency_delay_seconds,
      vocabularyWords: userState.vocabularyWords,
    });

    console.log("AI Evaluation:", evaluation);

    const {
      npc_reply_text,
      objective_completed,
      needs_subtle_hint,
      next_task_text,
      suggested_level,
      confidence_in_level,
      new_vocab_detected,
    } = evaluation;

    console.log("New vocab detected:", new_vocab_detected);

    const requestBaseUrl = `${req.protocol}://${req.get("host")}`;
    const npc_audio_url = await synthesizeSpeech(npc_reply_text, npc_id, requestBaseUrl);

    await saveConversationTurn({ userId: user_id, npcId: npc_id, transcript, npcReplyText: npc_reply_text });

    // Best-effort: XP is a gamification side effect and must never block
    // Mickey's reply if it fails (e.g. the increment_user_xp RPC/migration
    // isn't applied yet in this environment).
    incrementUserXp(user_id, XP_PER_CHAT_TURN).catch((err) => {
      console.error("incrementUserXp failed (non-fatal):", err);
    });

    if (new_vocab_detected.length > 0) {
      recordVocabulary({ userId: user_id, words: new_vocab_detected }).catch((err) => {
        console.error("recordVocabulary failed (non-fatal):", err);
      });
    }

    // Dynamic Quest Engine, Step 3: persist progression/calibration/
    // struggle-drop state ahead of responding, per CLAUDE.md's rules.
    const questStateUpdates = {};
    let show_level_unlocked;

    if (objective_completed) {
      questStateUpdates.current_task = next_task_text;
      questStateUpdates.consecutive_fails = 0;
      await incrementUserXp(user_id, QUEST_COMPLETION_XP);
    } else {
      const newConsecutiveFails = userState.consecutiveFails + 1;
      if (newConsecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        questStateUpdates.consecutive_fails = 0;
        questStateUpdates.estimated_level = Math.max(
          MIN_ESTIMATED_LEVEL,
          userState.estimatedLevel - 1
        );
      } else {
        questStateUpdates.consecutive_fails = newConsecutiveFails;
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
