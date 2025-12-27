import express from "express";
import Winner from "../models/Winner.js";
import PayoutState from "../models/PayoutState.js";

const router = express.Router();

// GET last winners
router.get("/last-winners", async (req, res) => {
  try {
    const winners = await Winner.find()
      .sort({ timestamp: -1 })
      .limit(20);

    res.json(winners);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/payout-state", async (req, res) => {
    const state = await PayoutState.findOne().sort({ lastRunAt: -1 });
    res.json(state || null);
  });

export default router;
