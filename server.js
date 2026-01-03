import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import rewardsRouter from "./routes/rewards.js";
import { runPayout } from "./services/payoutService.js";
import User from "./models/User.js";
import Score from "./models/Score.js";
import RoundState from "./models/RoundState.js";
import { PublicKey } from "@solana/web3.js";
import rateLimit from "express-rate-limit";

let leaderboardCache = {
  data: null,
  expiresAt: 0
};


dotenv.config();

const app = express();
app.set("trust proxy", 1);

app.use(cors({
  origin: true,   // ACCEPTĂ orice origin
  credentials: true
}));


app.use(express.json());


app.use("/api", rewardsRouter);




// =================================================
// MONGO
// =================================================

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    setInterval(runPayout, 2 * 60 * 1000);
  })
  .catch(err => console.error("❌ MongoDB error:", err));


// =================================================
// MIDDLEWARE AUTH
// =================================================

async function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Missing token" });

  const token = auth.replace("Bearer ", "");
  const user = await User.findOne({ token });

  if (!user) return res.status(401).json({ error: "Invalid token" });

  req.user = user;
  next();
}

// =================================================
// SIGNUP
// =================================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password, wallet } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = await User.findOne({ username });
    if (exists)
      return res.status(400).json({ error: "Username already taken" });

    if (!wallet)
      return res.status(400).json({ error: "Wallet required" });

    try {
      new PublicKey(wallet);
    } catch {
      return res.status(400).json({ error: "Invalid Solana wallet address" });
    }

    const passwordHash = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      username,
      passwordHash,
      token,
      wallet
    });

    res.json({
      token,
      user: {
        id: user._id,       // 🔥 IMPORTANT
        username: user.username,
        wallet: user.wallet
      }
    });

  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =================================================
// LOGIN
// =================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const passwordHash = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    if (user.passwordHash !== passwordHash) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // 🔒 REGENERĂM TOKEN LA FIECARE LOGIN
    user.token = crypto.randomBytes(32).toString("hex");
    await user.save();

    res.json({
      token: user.token,
      user: {
        id: user._id,
        username: user.username,
        wallet: user.wallet
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// =================================================
// SAVE SCORE
// =================================================
const saveScoreLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});


app.post(
  "/api/save-score",
  authRequired,
  saveScoreLimiter,
  async (req, res) => {
    try {
      const { score } = req.body;
      const user = req.user;

      // ===============================
      // 1️⃣ VALIDARE RUNDA (LEGATĂ DE START)
      // ===============================
      if (!user.gameRoundId || !user.gameStartedAt) {
        return res.status(400).json({ error: "Game not started" });
      }

      const round = await RoundState.findOne({
        roundId: user.gameRoundId
      });

      const GRACE_MS = 2 * 60 * 1000;

      if (
        !round ||
        round.paidAt ||
        Date.now() > round.endsAt.getTime() + GRACE_MS
      ) {
        // 🔥 INVALIDĂM COMPLET SESIUNEA
        user.gameStartedAt = null;
        user.gameRoundId = null;
        await user.save();

        return res.status(400).json({ error: "Round expired" });
      }

      // ===============================
      // 2️⃣ VALIDARE SCOR (BASIC)
      // ===============================
      if (!Number.isFinite(score) || score < 0 || score > 150) {
        user.gameStartedAt = null;
        user.gameRoundId = null;
        await user.save();

        return res.status(400).json({ error: "Invalid score" });
      }

      // ===============================
      // 3️⃣ VALIDARE TIMP JOC
      // ===============================
      const playTime = Date.now() - user.gameStartedAt.getTime();

      // minim anti-spam, NU anti-skill
      if (playTime < 1500) {
        user.gameStartedAt = null;
        user.gameRoundId = null;
        await user.save();

        return res.status(400).json({ error: "Game too short" });
      }

      // ===============================
      // 4️⃣ PLAUZIBILITATE SCOR
      // ===============================
      const MAX_SCORE_PER_SECOND = 3;
      const maxAllowedScore = Math.floor(
        (playTime / 1000) * MAX_SCORE_PER_SECOND
      );

      if (score > maxAllowedScore) {
        user.gameStartedAt = null;
        user.gameRoundId = null;
        await user.save();

        return res.status(400).json({ error: "Score not plausible" });
      }

      // ===============================
      // 5️⃣ BEST SCORE / USER / RUNDA
      // ===============================
      const existing = await Score.findOne({
        userId: user._id,
        roundId: round.roundId
      });

      if (existing) {
        if (score <= existing.score) {
          user.gameStartedAt = null;
          user.gameRoundId = null;
          await user.save();

          return res.json({ ignored: true });
        }

        existing.score = score;
        existing.timestamp = new Date();
        await existing.save();
      } else {
        await Score.create({
          userId: user._id,
          username: user.username,
          score,
          roundId: round.roundId
        });
      }

      // ===============================
      // 6️⃣ FINAL — INVALIDĂM SESIUNEA
      // ===============================
      user.gameStartedAt = null;
      user.gameRoundId = null;
      await user.save();

      // 🔥 invalidate leaderboard cache
      leaderboardCache.expiresAt = 0;

      res.json({ success: true });

    } catch (err) {
      console.error("SAVE SCORE ERROR:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);





// =================================================
// START GAME
// =================================================

app.post("/api/start-game", authRequired, async (req, res) => {
  try {
    // 🔁 luăm runda curentă
    const round = await RoundState.findOne().sort({ endsAt: -1 });

    if (!round || round.paidAt) {
      return res.status(400).json({ error: "No active round" });
    }

    // 🔒 resetăm orice sesiune veche (IMPORTANT)
    req.user.gameStartedAt = null;
    req.user.gameRoundId = null;

    // ▶️ pornim sesiunea NOUĂ, legată de runda curentă
    req.user.gameStartedAt = new Date();
    req.user.gameRoundId = round.roundId;

    await req.user.save();

    res.json({
      ok: true,
      roundId: round.roundId,
      endsAt: round.endsAt.getTime()
    });

  } catch (err) {
    console.error("START GAME ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});







// =================================================
// LEADERBOARD
// =================================================


app.get("/api/leaderboard", async (req, res) => {
  try {
    const now = Date.now();

    if (leaderboardCache.data && now < leaderboardCache.expiresAt) {
      return res.json(leaderboardCache.data);
    }

    const round = await RoundState.findOne().sort({ endsAt: -1 });
    if (!round) {
      return res.json({ leaderboard: [], endsAt: null, serverTime: Date.now() });
    }

    const results = await Score.aggregate([
      { $match: { roundId: round.roundId } },
      { $group: {
        _id: "$userId",
        username: { $first: "$username" },
        best_score: { $max: "$score" }
    }}
    ,
      { $sort: { best_score: -1 } },
      { $limit: 10 }
    ]);

    // 🔥 IMPORTANT: username direct din User la save-score
    const leaderboard = results.map(r => ({
      name: r.username,
      score: r.best_score
    }));
    

    const payload = {
      leaderboard,
      endsAt: round.endsAt.getTime(),
      serverTime: Date.now()
    };

    leaderboardCache = {
      data: payload,
      expiresAt: now + 3000 // 3 sec cache
    };

    res.json(payload);
  } catch (err) {
    console.error("LEADERBOARD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});



// =================================================
// START
// =================================================

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});


