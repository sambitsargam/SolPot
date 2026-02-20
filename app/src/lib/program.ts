import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PROGRAM_ID,
  RPC_URL,
  SEEDS,
  TOKEN_METADATA_PROGRAM_ID,
} from "./constants";
import type {
  GameConfigAccount,
  RoundAccount,
  LeaderboardAccount,
} from "./types";

/**
 * SolPot Arena IDL placeholder.
 * After `anchor build`, copy the generated IDL from
 * `anchor/target/idl/solpot.json` and import it here.
 * This inline IDL is kept minimal for type-safe interactions.
 */
const IDL: any = {
  version: "0.1.0",
  name: "solpot",
  metadata: {
    address: "22tsqvygTkEoomxNduhqEPYKA3DXfPPzNLXVxv9DAp8A",
  },
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
    {
      name: "enterRound",
      accounts: [
        { name: "gameConfig", isMut: false, isSigner: false },
        { name: "round", isMut: true, isSigner: false },
        { name: "playerEntry", isMut: true, isSigner: false },
        { name: "player", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "submitGuess",
      accounts: [
        { name: "round", isMut: true, isSigner: false },
        { name: "playerEntry", isMut: false, isSigner: false },
        { name: "player", isMut: false, isSigner: true },
      ],
      args: [{ name: "guess", type: "string" }],
    },
    {
      name: "distributePot",
      accounts: [
        { name: "gameConfig", isMut: false, isSigner: false },
        { name: "round", isMut: true, isSigner: false },
        { name: "winner", isMut: true, isSigner: false },
        { name: "feeReceiver", isMut: true, isSigner: false },
        { name: "leaderboard", isMut: true, isSigner: false },
      ],
      args: [],
    },
    {
      name: "mintRewardNft",
      accounts: [
        { name: "gameConfig", isMut: false, isSigner: false },
        { name: "round", isMut: true, isSigner: false },
        { name: "nftMint", isMut: true, isSigner: true },
        { name: "tokenAccount", isMut: true, isSigner: false },
        { name: "winner", isMut: false, isSigner: false },
        { name: "metadataAccount", isMut: true, isSigner: false },
        { name: "masterEdition", isMut: true, isSigner: false },
        { name: "payer", isMut: true, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
        { name: "metadataProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "uri", type: "string" },
      ],
    },
    {
      name: "closeRound",
      accounts: [
        { name: "gameConfig", isMut: false, isSigner: false },
        { name: "round", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
      ],
      args: [],
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
      name: "PlayerEntry",
      type: {
        kind: "struct",
        fields: [
          { name: "player", type: "publicKey" },
          { name: "round", type: "publicKey" },
          { name: "enteredAt", type: "i64" },
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
          {
            name: "entries",
            type: {
              vec: {
                defined: "LeaderboardEntry",
              },
            },
          },
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
  errors: [
    { code: 6000, name: "RoundNotActive", msg: "Round is not active" },
    { code: 6001, name: "RoundExpired", msg: "Round has expired" },
    { code: 6002, name: "RoundNotExpired", msg: "Round has not expired yet" },
    { code: 6003, name: "RoundAlreadyWon", msg: "Round already has a winner" },
    { code: 6004, name: "AlreadyEntered", msg: "Player has already entered" },
    { code: 6005, name: "MaxPlayersReached", msg: "Maximum players reached" },
    { code: 6006, name: "IncorrectGuess", msg: "Incorrect guess" },
    { code: 6007, name: "InsufficientFunds", msg: "Insufficient funds" },
    { code: 6008, name: "Unauthorized", msg: "Unauthorized action" },
    { code: 6009, name: "InvalidFeeBasisPoints", msg: "Invalid fee bps" },
    { code: 6010, name: "ArithmeticOverflow", msg: "Arithmetic overflow" },
    { code: 6011, name: "RoundStillActive", msg: "Round still active" },
    { code: 6012, name: "NoWinner", msg: "No winner" },
    { code: 6013, name: "PotAlreadyDistributed", msg: "Pot already distributed" },
    { code: 6014, name: "InvalidWordHash", msg: "Invalid word hash" },
    { code: 6015, name: "EntryFeeMismatch", msg: "Entry fee mismatch" },
    { code: 6016, name: "NftAlreadyMinted", msg: "NFT already minted" },
  ],
};

// ── PDA Derivation ──────────────────────────────────────────────

export function getGameConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.GAME_CONFIG)],
    PROGRAM_ID
  );
}

export function getLeaderboardPda(
  gameConfig: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.LEADERBOARD), gameConfig.toBuffer()],
    PROGRAM_ID
  );
}

export function getRoundPda(
  gameConfig: PublicKey,
  roundId: number
): [PublicKey, number] {
  const roundIdBuf = Buffer.alloc(8);
  roundIdBuf.writeBigUInt64LE(BigInt(roundId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.ROUND), gameConfig.toBuffer(), roundIdBuf],
    PROGRAM_ID
  );
}

export function getPlayerEntryPda(
  round: PublicKey,
  player: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PLAYER_ENTRY), round.toBuffer(), player.toBuffer()],
    PROGRAM_ID
  );
}

export function getMetadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

export function getMasterEditionPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

// ── Program Client ──────────────────────────────────────────────

export function getProgram(provider: AnchorProvider): Program {
  return new Program(IDL as any, provider);
}

export function getProvider(
  connection: Connection,
  wallet: any
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

// ── Instruction Builders ────────────────────────────────────────

export async function buildEnterRoundIx(
  program: Program,
  roundPda: PublicKey,
  gameConfigPda: PublicKey,
  player: PublicKey
): Promise<TransactionInstruction> {
  const [playerEntryPda] = getPlayerEntryPda(roundPda, player);

  return await program.methods
    .enterRound()
    .accountsStrict({
      gameConfig: gameConfigPda,
      round: roundPda,
      playerEntry: playerEntryPda,
      player,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function buildSubmitGuessIx(
  program: Program,
  roundPda: PublicKey,
  player: PublicKey,
  guess: string
): Promise<TransactionInstruction> {
  const [playerEntryPda] = getPlayerEntryPda(roundPda, player);

  return await program.methods
    .submitGuess(guess)
    .accountsStrict({
      round: roundPda,
      playerEntry: playerEntryPda,
      player,
    })
    .instruction();
}

// ── Account Fetchers ────────────────────────────────────────────

export async function fetchGameConfig(
  program: Program
): Promise<GameConfigAccount | null> {
  const [pda] = getGameConfigPda();
  try {
    const account = await (program.account as any).gameConfig.fetch(pda);
    return {
      authority: account.authority,
      roundCount: (account.roundCount as BN).toNumber(),
      entryFeeLamports: (account.entryFeeLamports as BN).toNumber(),
      feeBasisPoints: account.feeBasisPoints as number,
      bump: account.bump as number,
    };
  } catch {
    return null;
  }
}

export async function fetchRound(
  program: Program,
  roundPda: PublicKey
): Promise<RoundAccount | null> {
  try {
    const account = await (program.account as any).round.fetch(roundPda);
    return {
      id: (account.id as BN).toNumber(),
      gameConfig: account.gameConfig,
      wordHash: account.wordHash as number[],
      isActive: account.isActive as boolean,
      winner: account.winner,
      hasWinner: account.hasWinner as boolean,
      potLamports: (account.potLamports as BN).toNumber(),
      potDistributed: account.potDistributed as boolean,
      nftMinted: account.nftMinted as boolean,
      playerCount: account.playerCount as number,
      maxPlayers: account.maxPlayers as number,
      createdAt: (account.createdAt as BN).toNumber(),
      expiresAt: (account.expiresAt as BN).toNumber(),
      entryFeeLamports: (account.entryFeeLamports as BN).toNumber(),
      bump: account.bump as number,
    };
  } catch {
    return null;
  }
}

export async function fetchAllRounds(
  program: Program
): Promise<Array<{ publicKey: PublicKey; account: RoundAccount }>> {
  try {
    const accounts = await (program.account as any).round.all();
    return accounts.map((a: any) => ({
      publicKey: a.publicKey,
      account: {
        id: (a.account.id as BN).toNumber(),
        gameConfig: a.account.gameConfig,
        wordHash: a.account.wordHash as number[],
        isActive: a.account.isActive as boolean,
        winner: a.account.winner,
        hasWinner: a.account.hasWinner as boolean,
        potLamports: (a.account.potLamports as BN).toNumber(),
        potDistributed: a.account.potDistributed as boolean,
        nftMinted: a.account.nftMinted as boolean,
        playerCount: a.account.playerCount as number,
        maxPlayers: a.account.maxPlayers as number,
        createdAt: (a.account.createdAt as BN).toNumber(),
        expiresAt: (a.account.expiresAt as BN).toNumber(),
        entryFeeLamports: (a.account.entryFeeLamports as BN).toNumber(),
        bump: a.account.bump as number,
      },
    }));
  } catch {
    return [];
  }
}

export async function fetchLeaderboard(
  program: Program
): Promise<LeaderboardAccount | null> {
  const [gameConfigPda] = getGameConfigPda();
  const [leaderboardPda] = getLeaderboardPda(gameConfigPda);
  try {
    const account = await (program.account as any).leaderboard.fetch(leaderboardPda);
    return {
      gameConfig: account.gameConfig,
      entries: (account.entries as any[]).map((e: any) => ({
        player: e.player,
        wins: e.wins as number,
        totalWinnings: (e.totalWinnings as BN).toNumber(),
      })),
      bump: account.bump as number,
    };
  } catch {
    return null;
  }
}
