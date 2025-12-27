import Score from "../models/Score.js";
import User from "../models/User.js";
import Winner from "../models/Winner.js";
import PayoutState from "../models/PayoutState.js";
import RoundState from "../models/RoundState.js";
import { sendUSDC } from "./sendUSDC.js";
import { PublicKey } from "@solana/web3.js";

// ============================
// HELPERS
// ============================
function isValidSolanaAddress(addr) {
  try {
    new PublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

export async function runPayout() {
  console.log("Running payout job...");

  const now = new Date();
  const interval = 2 * 60 * 1000; // 2 min (DEV)
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
    // E. LEADERBOARD RUNDA CURENTĂ
    // ============================
    const leaderboard = await Score.aggregate([
      { $match: { roundId: round.roundId } },
      { $group: { _id: "$userId", best_score: { $max: "$score" } } },
      { $sort: { best_score: -1 } },
      { $limit: 3 }
    ]);

    if (leaderboard.length === 0) {
      console.log("No players this round");
    }

    const rewards = [1, 1, 1]; // $1 test

    // ============================
    // F. PAYOUT (SAFE)
    // ============================
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = await User.findById(entry._id);

      if (!user || !user.wallet) {
        console.log(`⚠️ Skipping user ${user?.username}: no wallet`);
        continue;
      }

      if (!isValidSolanaAddress(user.wallet)) {
        console.log(
          `⚠️ Skipping user ${user.username}: invalid Solana wallet (${user.wallet})`
        );
        continue;
      }

      const amount = rewards[i];
      const tx = await sendUSDC(user.wallet, amount);

      await Winner.create({
        userId: user._id,
        username: user.username,
        rank: i + 1,
        amount,
        wallet: user.wallet,
        tx,
        roundId: round.roundId
      });

      console.log(`✅ Paid $${amount} USDC to ${user.username}`);
    }

    // ============================
    // 🔒 G. MARCĂM RUNDA CA PLĂTITĂ
    // ============================
    round.paidAt = now;
    await round.save();

    // ============================
    // 🔄 H. PORNIM RUNDA NOUĂ
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
