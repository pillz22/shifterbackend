import Score from "../models/Score.js";
import User from "../models/User.js";
import Winner from "../models/Winner.js";
import PayoutState from "../models/PayoutState.js";

async function sendReward(wallet, amount) {
  console.log(`Sending $${amount} to wallet ${wallet}...`);
  return "FAKE_TX_" + Math.random().toString(36).slice(2, 10);
}

export async function runPayout() {
  console.log("Running payout job...");

  const now = new Date();
  const interval = 60 * 1000;
  const nextRunAt = new Date(now.getTime() + interval);

  try {
    // ✅ update payout state (source of truth)
    await PayoutState.findOneAndUpdate(
      {},
      { lastRunAt: now, nextRunAt },
      { upsert: true }
    );

    // 1. Top 3
    const leaderboard = await Score.aggregate([
      { $group: { _id: "$userId", best_score: { $max: "$score" } } },
      { $sort: { best_score: -1 } },
      { $limit: 3 }
    ]);

    if (leaderboard.length < 3) {
      console.log("Not enough players for payout.");
      return;
    }

    const rewards = [10, 5, 5];

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = await User.findById(entry._id);

      if (!user || !user.wallet) continue;

      // 🛑 anti-duplicate: same payout window
      const alreadyPaid = await Winner.findOne({
        userId: user._id,
        timestamp: { $gte: now - interval }
      });

      if (alreadyPaid) {
        console.log(`Skipping ${user.username}, already paid`);
        continue;
      }

      const amount = rewards[i];
      const tx = await sendReward(user.wallet, amount);

      await Winner.create({
        userId: user._id,
        username: user.username,
        rank: i + 1,
        amount,
        wallet: user.wallet,
        tx
      });

      console.log(`Paid $${amount} to ${user.username}`);
    }

  } catch (err) {
    console.error("PAYOUT ERROR:", err);
  }
}
