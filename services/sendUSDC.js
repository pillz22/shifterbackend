import {
    getOrCreateAssociatedTokenAccount,
    createTransferInstruction
  } from "@solana/spl-token";
  
  import { Transaction, PublicKey } from "@solana/web3.js";
  import { connection, treasury, USDC_MINT } from "./solana.js";
  
  const USDC_DECIMALS = 6;
  
  /**
   * wallet: string (recipient)
   * amountUSDC: number (ex: 10)
   */
  export async function sendUSDC(wallet, amountUSDC) {
    const recipient = new PublicKey(wallet);
  
    // ATA treasury
    const treasuryATA = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      USDC_MINT,
      treasury.publicKey
    );
  
    // ATA recipient
    const recipientATA = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      USDC_MINT,
      recipient
    );
  
    const amount = Math.round(amountUSDC * 10 ** USDC_DECIMALS);
  
    const ix = createTransferInstruction(
      treasuryATA.address,
      recipientATA.address,
      treasury.publicKey,
      amount
    );
  
    const tx = new Transaction().add(ix);
  
    const signature = await connection.sendTransaction(tx, [treasury]);
    await connection.confirmTransaction(signature, "confirmed");
  
    return signature; // 🔥 REAL TXID
  }
  