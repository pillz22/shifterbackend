import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export const connection = new Connection(
  process.env.SOLANA_RPC,
  "confirmed"
);

export const treasury = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_PRIVATE_KEY)
);

export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
