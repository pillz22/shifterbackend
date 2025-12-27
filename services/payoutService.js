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
  const interval = 2 * 60 * 1000; // 2 min
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
    // 🛑 D. RUNDA DEJA PROCESATĂ
    // ============================
    if (round.paidAt) {
      console.log("Round already processed, skipping");
      return;
    }

    // ============================
    // E. LEADERBOARD RUNDA
    // ============================
    const leaderboard = await Score.aggregate([
      { $match: { roundId: round.roundId } },
      { $group: { _id: "$userId", best_score: { $max: "$score" } } },
      { $sort: { best_score: -1 } },
      { $limit: 3 }
    ]);

    const rewards = [1, 1, 1]; // test

    // ============================
    // F. PROCESĂM WINNERII
    // ============================
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = await User.findById(entry._id);

      if (!user || !user.wallet) {
        console.log(`⚠️ Skipping user ${user?.username}: no wallet`);
        continue;
      }

      if (!isValidSolanaAddress(user.wallet)) {
        console.log(`⚠️ Skipping user ${user.username}: invalid wallet`);
        continue;
      }

      const amount = rewards[i];

      let tx = null;
      let paymentStatus = "paid";
      let failureReason = null;
      
      try {
        tx = await sendUSDC(user.wallet, amount);
      } catch (err) {
        paymentStatus = "failed";
        failureReason =
          err?.message ||
          "Payment failed (insufficient funds or simulation error)";
      
        console.error(
          `❌ Payment failed for ${user.username}:`,
          failureReason
        );
      }
      
      // 🔥 IMPORTANT: Winner se creează ORICUM
      await Winner.create({
        userId: user._id,
        username: user.username,
        rank: i + 1,
        amount,
        wallet: user.wallet,
        tx,
        paymentStatus,
        failureReason,
        roundId: round.roundId
      });
      
    }

    // ============================
    // 🔒 G. ÎNCHIDEM RUNDA
    // ============================
    round.paidAt = now;
    await round.save();

    // ============================
    // 🔄 H. PORNIM RUNDA NOUĂf
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
    console.error("PAYOUT ERROR (SYSTEM):", err);
  }
}
