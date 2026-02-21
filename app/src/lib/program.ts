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
  MPL_CORE_PROGRAM_ID,
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
  address: "22tsqvygTkEoomxNduhqEPYKA3DXfPPzNLXVxv9DAp8A",
  metadata: {
    name: "solpot",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "initialize_game",
      discriminator: [44, 62, 102, 247, 126, 208, 130, 215],
      accounts: [
        { name: "game_config", writable: true },
        { name: "leaderboard", writable: true },
        { name: "authority", writable: true, signer: true },
        { name: "system_program" },
      ],
      args: [
        { name: "entry_fee_lamports", type: "u64" },
        { name: "fee_basis_points", type: "u16" },
      ],
    },
    {
      name: "create_round",
      discriminator: [229, 218, 236, 169, 231, 80, 134, 112],
      accounts: [
        { name: "game_config", writable: true },
        { name: "round", writable: true },
        { name: "authority", writable: true, signer: true },
        { name: "system_program" },
      ],
      args: [
        { name: "word_hash", type: { array: ["u8", 32] } },
        { name: "max_players", type: "u32" },
        { name: "duration_seconds", type: "i64" },
      ],
    },
    {
      name: "enter_round",
      discriminator: [166, 162, 71, 230, 92, 51, 37, 43],
      accounts: [
        { name: "game_config" },
        { name: "round", writable: true },
        { name: "player_entry", writable: true },
        { name: "player", writable: true, signer: true },
        { name: "system_program" },
      ],
      args: [],
    },
    {
      name: "submit_guess",
      discriminator: [61, 124, 32, 227, 64, 198, 252, 3],
      accounts: [
        { name: "round", writable: true },
        { name: "player_entry" },
        { name: "player", signer: true },
      ],
      args: [{ name: "guess", type: "string" }],
    },
    {
      name: "distribute_pot",
      discriminator: [174, 253, 41, 240, 254, 75, 38, 160],
      accounts: [
        { name: "game_config" },
        { name: "round", writable: true },
        { name: "winner", writable: true },
        { name: "fee_receiver", writable: true },
        { name: "leaderboard", writable: true },
      ],
      args: [],
    },
    {
      name: "mint_reward_nft",
      discriminator: [78, 40, 77, 93, 134, 16, 33, 120],
      accounts: [
        { name: "game_config" },
        { name: "round", writable: true },
        { name: "asset", writable: true, signer: true },
        { name: "winner" },
        { name: "payer", writable: true, signer: true },
        { name: "mpl_core_program" },
        { name: "system_program" },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "uri", type: "string" },
      ],
    },
    {
      name: "close_round",
      discriminator: [149, 14, 81, 88, 230, 226, 234, 37],
      accounts: [
        { name: "game_config" },
        { name: "round", writable: true },
        { name: "authority", writable: true, signer: true },
      ],
      args: [],
    },
  ],
  accounts: [
    { name: "game_config", discriminator: [45, 146, 146, 33, 170, 69, 96, 133] },
    { name: "round", discriminator: [87, 127, 165, 51, 73, 78, 116, 174] },
    { name: "player_entry", discriminator: [158, 6, 39, 104, 234, 4, 153, 255] },
    { name: "leaderboard", discriminator: [247, 186, 238, 243, 194, 30, 9, 36] },
  ],
  types: [
    {
      name: "game_config",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "round_count", type: "u64" },
          { name: "entry_fee_lamports", type: "u64" },
          { name: "fee_basis_points", type: "u16" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "round",
      type: {
        kind: "struct",
        fields: [
          { name: "id", type: "u64" },
          { name: "game_config", type: "pubkey" },
          { name: "word_hash", type: { array: ["u8", 32] } },
          { name: "is_active", type: "bool" },
          { name: "winner", type: "pubkey" },
          { name: "has_winner", type: "bool" },
          { name: "pot_lamports", type: "u64" },
          { name: "pot_distributed", type: "bool" },
          { name: "nft_minted", type: "bool" },
          { name: "player_count", type: "u32" },
          { name: "max_players", type: "u32" },
          { name: "created_at", type: "i64" },
          { name: "expires_at", type: "i64" },
          { name: "entry_fee_lamports", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "player_entry",
      type: {
        kind: "struct",
        fields: [
          { name: "player", type: "pubkey" },
          { name: "round", type: "pubkey" },
          { name: "entered_at", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "leaderboard",
      type: {
        kind: "struct",
        fields: [
          { name: "game_config", type: "pubkey" },
          {
            name: "entries",
            type: {
              vec: {
                defined: { name: "leaderboard_entry" },
              },
            },
          },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "leaderboard_entry",
      type: {
        kind: "struct",
        fields: [
          { name: "player", type: "pubkey" },
          { name: "wins", type: "u32" },
          { name: "total_winnings", type: "u64" },
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
