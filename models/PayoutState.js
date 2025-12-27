import mongoose from "mongoose";

const payoutStateSchema = new mongoose.Schema({
  lastRunAt: { type: Date, required: true },
  nextRunAt: { type: Date, required: true }
});

export default mongoose.model("PayoutState", payoutStateSchema);
