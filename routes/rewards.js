import express from "express";
import Winner from "../models/Winner.js";
import PayoutState from "../models/PayoutState.js";
import authRequired from "../middleware/authRequired.js";

const router = express.Router();

// =================================================
// GET last winners (paid + failed)
// =================================================
router.get("/last-winners", async (req, res) => {
  try {
    const winners = await Winner.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(winners);
  } catch (err) {
    console.error("LAST WINNERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =================================================
// GET payout timer
// =================================================
router.get("/payout-state", async (req, res) => {
  try {
    const state = await PayoutState.findOne().sort({ lastRunAt: -1 });
    res.json(state || null);
  } catch (err) {
    console.error("PAYOUT STATE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =================================================
// MARK PAYOUT AS SEEN (auth)
// =================================================
router.post("/mark-payout-seen", authRequired, async (req, res) => {
  try {
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({ error: "Missing winnerId" });
    }

    // 🔒 securitate: doar owner-ul payout-ului
    const winner = await Winner.findOne({
      _id: winnerId,
      userId: req.user._id
    });

    if (!winner) {
      return res.status(404).json({ error: "Winner not found" });
    }

    // deja marcat
    if (winner.seen === true) {
      return res.json({ success: true });
    }

    // ✅ AICI este exact linia ta
    winner.seen = true;
    await winner.save();

    res.json({ success: true });

  } catch (err) {
    console.error("MARK PAYOUT SEEN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
