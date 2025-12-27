import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import rewardsRouter from "./routes/rewards.js";
import { runPayout } from "./services/payoutService.js";
import User from "./models/User.js";
import Score from "./models/Score.js";




dotenv.config();

const app = express();
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
    setInterval(runPayout, 1 * 60 * 1000);
    runPayout();
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
    

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.create({ username, passwordHash, token, wallet });

    res.json({
      token,
      user: { username }
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

    if (!username || !password)
      return res.status(400).json({ error: "Missing fields" });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ error: "Invalid credentials" });

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    if (user.passwordHash !== passwordHash)
      return res.status(400).json({ error: "Invalid credentials" });

    res.json({
      token: user.token,
      user: { username }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =================================================
// SAVE SCORE
// =================================================

app.post("/api/save-score", authRequired, async (req, res) => {
  try {
    const { score } = req.body;
    const user = req.user;

    if (!score || score <= 0)
      return res.status(400).json({ error: "Invalid score" });

    if (score > 150)
      return res.status(400).json({ error: "Score exceeds limit" });

    const now = Date.now();
    if (user.lastScoreAt && now - user.lastScoreAt < 3000)
      return res.status(429).json({ error: "Too fast" });

    user.lastScoreAt = now;
    await user.save();

    await Score.create({ userId: user._id, score });

    res.json({ success: true });

  } catch (err) {
    console.error("SAVE SCORE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =================================================
// LEADERBOARD
// =================================================

app.get("/api/leaderboard", async (req, res) => {
  try {
    const results = await Score.aggregate([
      { $group: { _id: "$userId", best_score: { $max: "$score" } } },
      { $sort: { best_score: -1 } },
      { $limit: 10 }
    ]);

    const data = await Promise.all(
      results.map(async (r) => {
        const user = await User.findById(r._id);
        return {
          name: user?.username || "Unknown",
          score: r.best_score
        };
      })
    );

    res.json(data);

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


