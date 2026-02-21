import { PublicKey } from "@solana/web3.js";

/** Program ID — update after `anchor build && anchor keys list` */
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "22tsqvygTkEoomxNduhqEPYKA3DXfPPzNLXVxv9DAp8A"
);

/** Solana Devnet RPC endpoint */
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

/** Solana Devnet WebSocket endpoint */
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "wss://api.devnet.solana.com";

/** Jupiter Metis Swap API base URL */
export const JUPITER_API_BASE = "https://api.jup.ag/swap/v1";

/** Jupiter API key (from https://portal.jup.ag) */
export const JUPITER_API_KEY =
  process.env.NEXT_PUBLIC_JUPITER_API_KEY || "";

/** Metaplex Core program ID */
export const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

/** Wrapped SOL mint address */
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

/** USDC mint (mainnet — Jupiter only supports mainnet tokens) */
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

/** Whether we're running on devnet (Jupiter swaps only work on mainnet) */
export const IS_DEVNET = RPC_URL.includes("devnet");

/** Common token list for the token selector */
export const TOKEN_LIST = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
];

/** PDA seeds */
export const SEEDS = {
  GAME_CONFIG: "game_config",
  ROUND: "round",
  PLAYER_ENTRY: "player_entry",
  LEADERBOARD: "leaderboard",
} as const;
