import Score from "../models/Score.js";
import User from "../models/User.js";
import Winner from "../models/Winner.js";
import PayoutState from "../models/PayoutState.js";
import RoundState from "../models/RoundState.js";

export async function runPayout() {
  console.log("Running payout job...");

  const now = new Date();
  const interval = 2 * 60 * 1000; // 1 minut (DEV)
  const nextRunAt = new Date(now.getTime() + interval);

  try {
    // ============================
    // A. LUĂM SAU CREĂM RUNDA
    // ============================
    let round = await RoundState.findOne();

    if (!round) {
      await RoundState.create({
        roundId: 1,
        startedAt: now,
        endsAt: new Date(now.getTime() + interval),
        paidAt: null
      });

      console.log("Round initialized");
      return; // ⛔ NU plătim la inițializare
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
    // 🛑 C. RUNDA NU S-A TERMINAT
    // ============================
    if (now < round.endsAt) {
      console.log("Round still active, skipping payout");
      return;
    }

    // ============================
    // 🛑 D. RUNDA DEJA PLĂTITĂ
    // ============================
    if (round.paidAt) {
      console.log("Round already paid, skipping");
      return;
    }

    // ============================
    // E. PAYOUT RUNDA ÎNCHEIATĂ
    // ============================
    const leaderboard = await Score.aggregate([
      { $match: { roundId: round.roundId } },
      { $group: { _id: "$userId", best_score: { $max: "$score" } } },
      { $sort: { best_score: -1 } },
      { $limit: 3 }
    ]);

    const rewards = [10, 5, 5];

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
    // 🔒 F. MARCĂM RUNDA CA PLĂTITĂ
    // ============================
    round.paidAt = now;
    await round.save();

    // ============================
    // 🔄 G. PORNIM RUNDA NOUĂ
    // ============================
    await RoundState.updateOne(
      { _id: round._id },
      {
        roundId: round.roundId + 1,
        startedAt: now,
        endsAt: new Date(now.getTime() + interval),
        paidAt: null
      }
    );

    console.log(`New round ${round.roundId + 1} started`);

  } catch (err) {
    console.error("PAYOUT ERROR:", err);
  }
}
