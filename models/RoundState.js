import mongoose from "mongoose";

const roundStateSchema = new mongoose.Schema({
  roundId: { type: Number, required: true },
  startedAt: { type: Date, required: true },
  endsAt: { type: Date, required: true }, // 🔥 FOARTE IMPORTANT
  paidAt: { type: Date, default: null }
});

export default mongoose.model("RoundState", roundStateSchema);
