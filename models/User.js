import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: { type: String, required: true },
  token: String,
  wallet: String,
  createdAt: { type: Date, default: Date.now },
  lastScoreAt: Date
});

export default mongoose.model("User", userSchema);
