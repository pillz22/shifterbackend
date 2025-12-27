import Score from "../models/Score.js";
import User from "../models/User.js";
import Winner from "../models/Winner.js";
import PayoutState from "../models/PayoutState.js";
import RoundState from "../models/RoundState.js";

export async function runPayout() {
  console.log("Running payout job...");

  const now = new Date();
  const interval = 60 * 1000; // 1 min (DEV)
  const nextRunAt = new Date(now.getTime() + interval);

  try {
    // ============================
    // A. LUĂM RUNDA CURENTĂ
    // ============================
    let round = await RoundState.findOne();

    if (!round) {
      round = await RoundState.create({
        roundId: 1,
        startedAt: now
      });
    }

    // ============================
    // B. PAYOUT STATE (TIMER)
    // ============================
    await PayoutState.findOneAndUpdate(
      {},
      { lastRunAt: now, nextRunAt },
      { upsert: true }
    );

    // ============================
    // C. LUĂM DOAR SCORURILE DIN RUNDA CURENTĂ
    // ============================
    const leaderboard = await Score.aggregate([
      { $match: { roundId: round.roundId } },
      { $group: { _id: "$userId", best_score: { $max: "$score" } } },
      { $sort: { best_score: -1 } },
      { $limit: 3 }
    ]);

    if (leaderboard.length === 0) {
      console.log("No players this round.");
      return;
    }

    const rewards = [10, 5, 5];

    // ============================
    // D. PLĂTIM WINNERII
    // ============================
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = await User.findById(entry._id);
      if (!user || !user.wallet) continue;

      const tx = "FAKE_TX_" + Math.random().toString(36).slice(2, 10);

      await Winner.create({
        userId: user._id,
        username: user.username,
        rank: i + 1,
        amount: rewards[i],
        wallet: user.wallet,
        tx,
        roundId: round.roundId
      });

      console.log(`Paid $${rewards[i]} to ${user.username}`);
    }

    // ============================
    // E. 🔄 TRECEM LA RUNDA URMĂTOARE (RESET LOGIC)
    // ============================
    round.roundId += 1;
    round.startedAt = new Date();
    await round.save();

  } catch (err) {
    console.error("PAYOUT ERROR:", err);
  }
}
