import express from "express";
import Winner from "../models/Winner.js";
import PayoutState from "../models/PayoutState.js";

const router = express.Router();

// GET last winners (TOȚI: paid + failed)
router.get("/last-winners", async (req, res) => {
  try {
    const winners = await Winner.find()
      .sort({ createdAt: -1 }) // 🔥 FIX CRITIC
      .limit(20)
      .lean();

    res.json(winners);
  } catch (err) {
    console.error("LAST WINNERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET payout timer
router.get("/payout-state", async (req, res) => {
  const state = await PayoutState.findOne().sort({ lastRunAt: -1 });
  res.json(state || null);
});

router.post("/mark-payout-seen", authRequired, async (req, res) => {
  try {
    const { winnerId } = req.body;

    const winner = await Winner.findOne({
      _id: winnerId,
      userId: req.user._id
    });

    if (!winner) {
      return res.status(404).json({ error: "Winner not found" });
    }

    if (winner.seen) {
      return res.json({ success: true }); // deja marcat
    }

    winner.seen = true;     // 👈 AICI ESTE LINIA TA
    await winner.save();

    res.json({ success: true });
  } catch (err) {
    console.error("MARK PAYOUT SEEN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
