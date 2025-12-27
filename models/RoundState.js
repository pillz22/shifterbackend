import mongoose from "mongoose";

const roundStateSchema = new mongoose.Schema({
  roundId: { type: Number, required: true },
  startedAt: { type: Date, required: true }
});

export default mongoose.model("RoundState", roundStateSchema);
