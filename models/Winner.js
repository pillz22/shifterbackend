import mongoose from "mongoose";

const WinnerSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    username: String,
    rank: Number,
    amount: Number,
    wallet: String,
    tx: String,
    roundId: Number,
    timestamp: { type: Date, default: Date.now }
  });
  

export default mongoose.model("Winner", WinnerSchema);
