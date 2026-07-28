const express = require("express");

const { getUserXp } = require("../services/supabase");

const router = express.Router();

// GET /api/users/:userId/xp
router.get("/users/:userId/xp", async (req, res) => {
  const { userId } = req.params;

  try {
    const xp = await getUserXp(userId);
    return res.status(200).json({ xp });
  } catch (err) {
    console.error("GET /api/users/:userId/xp failed:", err);
    return res.status(500).json({ error: "Failed to fetch XP." });
  }
});

module.exports = router;
