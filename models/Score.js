import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    score: Number,
    roundId: Number,
    timestamp: { type: Date, default: Date.now }
  });
  

export default mongoose.model("Score", scoreSchema);
