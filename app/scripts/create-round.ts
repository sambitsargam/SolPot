/**
 * Create a new round on devnet.
 *
 * Usage:
 *   npx tsx scripts/create-round.ts                          # Word Guess (default, empty answer)
 *   npx tsx scripts/create-round.ts word "ocean"             # Word Guess with secret "ocean"
 *   npx tsx scripts/create-round.ts number                 # Lucky Number (1-100)
 *   npx tsx scripts/create-round.ts trivia "Solana (SOL)" "What is the native token of Solana?" "Ethereum,Solana (SOL),Bitcoin,Cardano" "Crypto"
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

type GameType = "word-guess" | "lucky-number" | "trivia";

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

  // Parse game type from CLI args
  const args = process.argv.slice(2);
  let gameType: GameType = "word-guess";
  let secretAnswer = "";
  let triviaQuestion = "";
  let triviaOptions: string[] = [];
  let triviaCategory = "General";

  if (args[0] === "word" || args[0] === "w") {
    gameType = "word-guess";
    secretAnswer = args[1] || "";
  } else if (args[0] === "number" || args[0] === "n") {
    gameType = "lucky-number";
    const num = parseInt(args[1] || "0", 10);
    if (num < 1 || num > 100) {
      console.log("Lucky number must be 1-100. Using random number.");
      secretAnswer = String(Math.floor(Math.random() * 100) + 1);
    } else {
      secretAnswer = String(num);
    }
  } else if (args[0] === "trivia" || args[0] === "t") {
    gameType = "trivia";
    secretAnswer = args[1] || "";
    triviaQuestion = args[2] || "What is the answer?";
    triviaOptions = args[3] ? args[3].split(",") : [secretAnswer, "Wrong 1", "Wrong 2", "Wrong 3"];
    triviaCategory = args[4] || "General";
  } else if (args[0]) {
    // If just a word is provided, treat as word-guess answer
    secretAnswer = args[0];
  }

  const wordHash = createHash("sha256").update(secretAnswer).digest();

  const roundIdBuf = Buffer.alloc(8);
  roundIdBuf.writeBigUInt64LE(BigInt(roundCount));
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), gameConfigPda.toBuffer(), roundIdBuf],
    PROGRAM_ID
  );

  console.log(`\nCreating Round #${roundCount} (${gameType})`);
  console.log("Secret answer:", secretAnswer || "(empty)");
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
      864000n   // 10 day duration
    ),
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [authority], {
    commitment: "confirmed",
  });

  console.log("✓ Round #" + roundCount + " created! Tx:", sig);

  // ── Auto-update gameTypes.ts ──
  const gameTypesPath = path.resolve(__dirname, "../src/lib/gameTypes.ts");
  let gameTypesContent = fs.readFileSync(gameTypesPath, "utf-8");

  // Add to ROUND_GAME_TYPES
  const roundMapRegex = /(export const ROUND_GAME_TYPES:\s*Record<number,\s*GameType>\s*=\s*\{[\s\S]*?)(};)/;
  const match = gameTypesContent.match(roundMapRegex);
  if (match) {
    const existing = match[1];
    const closing = match[2];
    // Check if this round ID is already in the map
    if (!existing.includes(`${roundCount}:`)) {
      const newEntry = `  ${roundCount}: "${gameType}",\n`;
      gameTypesContent = gameTypesContent.replace(roundMapRegex, `${existing}${newEntry}${closing}`);
      console.log(`\n✓ Added round ${roundCount} → "${gameType}" to ROUND_GAME_TYPES`);
    }
  }

  // Add trivia question if applicable
  if (gameType === "trivia" && triviaQuestion) {
    const triviaMapRegex = /(export const TRIVIA_QUESTIONS:\s*Record<number,\s*TriviaQuestion>\s*=\s*\{[\s\S]*?)(};)/;
    const triviaMatch = gameTypesContent.match(triviaMapRegex);
    if (triviaMatch && !triviaMatch[1].includes(`${roundCount}:`)) {
      const triviaEntry = `  ${roundCount}: {\n    question: ${JSON.stringify(triviaQuestion)},\n    options: ${JSON.stringify(triviaOptions)},\n    category: ${JSON.stringify(triviaCategory)},\n  },\n`;
      gameTypesContent = gameTypesContent.replace(triviaMapRegex, `${triviaMatch[1]}${triviaEntry}${triviaMatch[2]}`);
      console.log(`✓ Added trivia question for round ${roundCount}`);
    }
  }

  fs.writeFileSync(gameTypesPath, gameTypesContent, "utf-8");
  console.log("✓ gameTypes.ts updated automatically");
  console.log("\nRefresh the frontend to see the new round.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
