import express from "express";
import Winner from "../models/Winner.js";

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

export default router;
