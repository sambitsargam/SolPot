/**
 * Create a new round on devnet.
 * Run: npx tsx scripts/create-round.ts
 */
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const PROGRAM_ID = new PublicKey("22tsqvygTkEoomxNduhqEPYKA3DXfPPzNLXVxv9DAp8A");
const RPC_URL = "https://api.devnet.solana.com";

// create_round discriminator: [229,218,236,169,231,80,134,112]
const CREATE_ROUND_DISC = Buffer.from([229, 218, 236, 169, 231, 80, 134, 112]);

function encodeCreateRoundArgs(
  wordHash: number[],
  maxPlayers: number,
  durationSeconds: bigint
): Buffer {
  // disc (8) + wordHash (32) + maxPlayers (4, u32 LE) + durationSeconds (8, i64 LE)
  const buf = Buffer.alloc(8 + 32 + 4 + 8);
  CREATE_ROUND_DISC.copy(buf, 0);
  Buffer.from(wordHash).copy(buf, 8);
  buf.writeUInt32LE(maxPlayers, 40);
  buf.writeBigInt64LE(durationSeconds, 44);
  return buf;
}

async function main() {
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/solpot-dev.json"
  );
  const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  console.log("Authority:", authority.publicKey.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(authority.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  const [gameConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    PROGRAM_ID
  );

  // Fetch current round count from gameConfig account
  const gameConfigInfo = await connection.getAccountInfo(gameConfigPda);
  if (!gameConfigInfo) {
    throw new Error("Game not initialized!");
  }

  // Parse roundCount from gameConfig: authority(32) + roundCount(8) starting at offset 8 (discriminator)
  const data = gameConfigInfo.data;
  const roundCount = Number(data.readBigUInt64LE(8 + 32)); // Skip 8-byte discriminator + 32-byte authority
  console.log("Current round count:", roundCount);

  const secretWord = "";
  const wordHash = createHash("sha256").update(secretWord).digest();

  const roundIdBuf = Buffer.alloc(8);
  roundIdBuf.writeBigUInt64LE(BigInt(roundCount));
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), gameConfigPda.toBuffer(), roundIdBuf],
    PROGRAM_ID
  );

  console.log(`\nCreating Round #${roundCount}`);
  console.log("Secret word:", secretWord);
  console.log("Round PDA:", roundPda.toBase58());

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: gameConfigPda, isSigner: false, isWritable: true },
      { pubkey: roundPda, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeCreateRoundArgs(
      Array.from(wordHash),
      10,       // max 10 players
      7200n     // 2 hour duration
    ),
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [authority], {
    commitment: "confirmed",
  });

  console.log("✓ Round #" + roundCount + " created! Tx:", sig);
  console.log("\nRefresh the frontend to see the new round.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
