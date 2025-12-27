import mongoose from "mongoose";

const WinnerSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  username: String,
  rank: Number,        // 1, 2 sau 3
  amount: Number,      // 10 sau 5$
  wallet: String,      // îl vei adăuga în DB la user
  tx: String,          // TX hash după payout
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Winner", WinnerSchema);
