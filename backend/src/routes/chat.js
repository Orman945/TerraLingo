const express = require("express");
const multer = require("multer");

const { transcribeAudio } = require("../services/whisper");
const { generateNpcReply } = require("../services/llm");
const { synthesizeSpeech } = require("../services/elevenlabs");
const { getUserContext, saveConversationTurn, recordVocabulary, incrementUserXp } = require("../services/supabase");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// XP awarded per completed chat turn (transcribed, replied to, and voiced).
const XP_PER_CHAT_TURN = 50;

// POST /api/chat
// multipart/form-data: user_id, npc_id, audio_file
router.post("/chat", upload.single("audio_file"), async (req, res) => {
  const { user_id, npc_id } = req.body;
  const audioFile = req.file;

  if (!user_id || !npc_id || !audioFile) {
    return res.status(400).json({
      error: "user_id, npc_id, and audio_file are all required.",
    });
  }

  try {
    const transcript = await transcribeAudio(audioFile.buffer, audioFile.mimetype);

    const { estimatedLevel, vocabularyWords } = await getUserContext(user_id);

    const { npc_reply_text, new_vocab_detected } = await generateNpcReply({
      transcript,
      estimatedLevel,
      vocabularyWords,
    });

    const requestBaseUrl = `${req.protocol}://${req.get("host")}`;
    const npc_audio_url = await synthesizeSpeech(npc_reply_text, npc_id, requestBaseUrl);

    await Promise.all([
      saveConversationTurn({ userId: user_id, npcId: npc_id, transcript, npcReplyText: npc_reply_text }),
      recordVocabulary({ userId: user_id, words: new_vocab_detected }),
    ]);

    // Best-effort: XP is a gamification side effect and must never block
    // Mickey's reply if it fails (e.g. the increment_user_xp RPC/migration
    // isn't applied yet in this environment).
    incrementUserXp(user_id, XP_PER_CHAT_TURN).catch((err) => {
      console.error("incrementUserXp failed (non-fatal):", err);
    });

    return res.status(200).json({
      transcript,
      npc_reply_text,
      npc_audio_url,
      new_vocab_detected,
    });
  } catch (err) {
    console.error("POST /api/chat failed:", err);
    return res.status(500).json({ error: "Failed to process chat turn." });
  }
});

module.exports = router;
