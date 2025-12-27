import Score from "../models/Score.js";
import User from "../models/User.js";
import Winner from "../models/Winner.js";

// aici vei pune funcția reală care trimite premiul
async function sendReward(wallet, amount) {
  console.log(`Sending $${amount} to wallet ${wallet}...`);

  // TODO: HERE you connect wallet & send transaction
  // return real TXID
  return "FAKE_TX_" + Math.random().toString(36).slice(2, 10);
}

export async function runPayout() {
  console.log("Running payout job...");

  try {
    // 1. Luăm top 3
    const leaderboard = await Score.aggregate([
      { $group: { _id: "$userId", best_score: { $max: "$score" } } },
      { $sort: { best_score: -1 } },
      { $limit: 3 }
    ]);

    if (leaderboard.length < 3) {
      console.log("Not enough players for payout.");
      return;
    }

    // premiile
    const rewards = [10, 5, 5];

    // 2. Trimitem premiile
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = await User.findById(entry._id);

      if (!user || !user.wallet) {
        console.log(`User ${user?.username} has no wallet`);
        continue;
      }

      const amount = rewards[i];
      const tx = await sendReward(user.wallet, amount);

      // 3. Salvăm în DB
      await Winner.create({
        userId: user._id,
        username: user.username,
        rank: i + 1,
        amount,
        wallet: user.wallet,
        tx
      });

      console.log(`Paid $${amount} to ${user.username} (TX ${tx})`);
    }

  } catch (err) {
    console.error("PAYOUT ERROR:", err);
  }
}
