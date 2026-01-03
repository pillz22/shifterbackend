import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: { type: String, required: true },

  token: { type: String, index: true }, // 🔥 important
  wallet: String,

  createdAt: { type: Date, default: Date.now },

  // 🔒 anti-cheat
  gameStartedAt: { type: Date, default: null },
  lastScoreAt: Date,
  lastScoredRound: Number // opțional, dar recomandat
});

export default mongoose.model("User", userSchema);
