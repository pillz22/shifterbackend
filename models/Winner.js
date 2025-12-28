import mongoose from "mongoose";

const winnerSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  username: String,
  rank: Number,
  amount: Number,
  wallet: String,
  tx: String,
  paymentStatus: {
    type: String,
    enum: ["paid", "failed"],
    default: "paid"
  },
  failureReason: String,

  roundId: Number,
  createdAt: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false }

});

export default mongoose.model("Winner", winnerSchema);
