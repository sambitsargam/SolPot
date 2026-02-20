/**
 * Initialize the SolPot Arena game on devnet.
 * Run: npx ts-node --esm scripts/init-game.ts
 */

import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { AnchorProvider, Program, BN, Wallet } from "@coral-xyz/anchor";

const PROGRAM_ID = new PublicKey("22tsqvygTkEoomxNduhqEPYKA3DXfPPzNLXVxv9DAp8A");
const RPC_URL = "https://api.devnet.solana.com";

// Entry fee: 0.05 SOL
const ENTRY_FEE = new BN(0.05 * LAMPORTS_PER_SOL);
// Platform fee: 2.5%
const FEE_BPS = 250;

const IDL: any = {
  version: "0.1.0",
  name: "solpot",
  metadata: { address: PROGRAM_ID.toBase58() },
  instructions: [
    {
      name: "initializeGame",
      accounts: [
        { name: "gameConfig", isMut: true, isSigner: false },
        { name: "leaderboard", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "entryFeeLamports", type: "u64" },
        { name: "feeBasisPoints", type: "u16" },
      ],
    },
    {
      name: "createRound",
      accounts: [
        { name: "gameConfig", isMut: true, isSigner: false },
        { name: "round", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "wordHash", type: { array: ["u8", 32] } },
        { name: "maxPlayers", type: "u32" },
        { name: "durationSeconds", type: "i64" },
      ],
    },
  ],
  accounts: [
    {
      name: "GameConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "roundCount", type: "u64" },
          { name: "entryFeeLamports", type: "u64" },
          { name: "feeBasisPoints", type: "u16" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Round",
      type: {
        kind: "struct",
        fields: [
          { name: "id", type: "u64" },
          { name: "gameConfig", type: "publicKey" },
          { name: "wordHash", type: { array: ["u8", 32] } },
          { name: "isActive", type: "bool" },
          { name: "winner", type: "publicKey" },
          { name: "hasWinner", type: "bool" },
          { name: "potLamports", type: "u64" },
          { name: "potDistributed", type: "bool" },
          { name: "nftMinted", type: "bool" },
          { name: "playerCount", type: "u32" },
          { name: "maxPlayers", type: "u32" },
          { name: "createdAt", type: "i64" },
          { name: "expiresAt", type: "i64" },
          { name: "entryFeeLamports", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Leaderboard",
      type: {
        kind: "struct",
        fields: [
          { name: "gameConfig", type: "publicKey" },
          { name: "entries", type: { vec: { defined: "LeaderboardEntry" } } },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "LeaderboardEntry",
      type: {
        kind: "struct",
        fields: [
          { name: "player", type: "publicKey" },
          { name: "wins", type: "u32" },
          { name: "totalWinnings", type: "u64" },
        ],
      },
    },
  ],
};

async function main() {
  // Load keypair
  const keypairPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/solpot-dev.json"
  );
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Authority:", authority.publicKey.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(authority.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const program = new (Program as any)(IDL, PROGRAM_ID, provider);

  // Derive PDAs
  const [gameConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    PROGRAM_ID
  );
  const [leaderboardPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("leaderboard"), gameConfigPda.toBuffer()],
    PROGRAM_ID
  );

  console.log("Game Config PDA:", gameConfigPda.toBase58());
  console.log("Leaderboard PDA:", leaderboardPda.toBase58());

  // Check if already initialized
  const existing = await connection.getAccountInfo(gameConfigPda);
  if (existing) {
    console.log("Game already initialized! Skipping...");
  } else {
    console.log("\n--- Initializing Game ---");
    console.log("Entry Fee:", ENTRY_FEE.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("Fee BPS:", FEE_BPS, `(${FEE_BPS / 100}%)`);

    const tx = await program.methods
      .initializeGame(ENTRY_FEE, FEE_BPS)
      .accountsStrict({
        gameConfig: gameConfigPda,
        leaderboard: leaderboardPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✓ Game initialized! Tx:", tx);
  }

  // Create first round with a secret word
  const { createHash } = await import("crypto");
  const secretWord = "solana";
  const wordHash = createHash("sha256").update(secretWord).digest();

  // Get current round count
  const gameConfig = await (program.account as any).gameConfig.fetch(gameConfigPda);
  const roundId = gameConfig.roundCount.toNumber();

  const roundIdBuf = Buffer.alloc(8);
  roundIdBuf.writeBigUInt64LE(BigInt(roundId));
  const [roundPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("round"), gameConfigPda.toBuffer(), roundIdBuf],
    PROGRAM_ID
  );

  console.log("\n--- Creating Round #" + roundId + " ---");
  console.log("Round PDA:", roundPda.toBase58());
  console.log("Secret word:", secretWord, "(hash:", wordHash.toString("hex").slice(0, 16) + "...)");

  const roundTx = await program.methods
    .createRound(
      Array.from(wordHash),
      10, // max players
      new BN(7200) // 2 hour duration
    )
    .accountsStrict({
      gameConfig: gameConfigPda,
      round: roundPda,
      authority: authority.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✓ Round created! Tx:", roundTx);
  console.log("\nDone! Refresh the frontend to see the game.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
