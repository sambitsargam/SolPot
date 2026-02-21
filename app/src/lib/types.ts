import { PublicKey } from "@solana/web3.js";

/** On-chain GameConfig account data */
export interface GameConfigAccount {
  authority: PublicKey;
  roundCount: number;
  entryFeeLamports: number;
  feeBasisPoints: number;
  bump: number;
}

/** On-chain Round account data */
export interface RoundAccount {
  id: number;
  gameConfig: PublicKey;
  wordHash: number[];
  isActive: boolean;
  winner: PublicKey;
  hasWinner: boolean;
  potLamports: number;
  potDistributed: boolean;
  nftMinted: boolean;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  expiresAt: number;
  entryFeeLamports: number;
  bump: number;
}

/** On-chain PlayerEntry account data */
export interface PlayerEntryAccount {
  player: PublicKey;
  round: PublicKey;
  enteredAt: number;
  bump: number;
}

/** On-chain LeaderboardEntry */
export interface LeaderboardEntryData {
  player: PublicKey;
  wins: number;
  totalWinnings: number;
}

/** On-chain Leaderboard account data */
export interface LeaderboardAccount {
  gameConfig: PublicKey;
  entries: LeaderboardEntryData[];
  bump: number;
}

/** Jupiter Quote response (Metis API) */
export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

/** Jupiter Swap Instructions response */
export interface JupiterSwapInstructionsResponse {
  tokenLedgerInstruction?: InstructionData;
  computeBudgetInstructions: InstructionData[];
  setupInstructions: InstructionData[];
  swapInstruction: InstructionData;
  cleanupInstruction?: InstructionData;
  addressLookupTableAddresses: string[];
}

export interface InstructionData {
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string;
}

/** Token info for the token selector */
export interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI: string;
}

/** Arcium encrypted guess payload (RescueCipher) */
export interface EncryptedGuess {
  /** RescueCipher ciphertext blocks — each is a [u8; 32] field element */
  ciphertext: Uint8Array[];
  /** 16-byte nonce used with RescueCipher */
  nonce: Uint8Array;
  /** Ephemeral x25519 public key for ECDH with MXE */
  clientPublicKey: Uint8Array;
}

/** Real-time update event types */
export type GameEvent =
  | { type: "round_created"; data: { roundId: number; entryFee: number; expiresAt: number; maxPlayers: number } }
  | { type: "player_entered"; data: { roundId: number; player: string; potLamports: number; playerCount: number } }
  | { type: "guess_result"; data: { roundId: number; player: string; isCorrect: boolean } }
  | { type: "pot_distributed"; data: { roundId: number; winner: string; winnerAmount: number; feeAmount: number } }
  | { type: "nft_minted"; data: { roundId: number; winner: string; mint: string } }
  | { type: "round_closed"; data: { roundId: number } };
