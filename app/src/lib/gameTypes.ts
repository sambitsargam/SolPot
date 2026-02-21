/**
 * Game type definitions for the multi-game portal.
 *
 * All game types reuse the same Solana program — the contract stores
 * a SHA-256 hash and compares submitted guesses against it.
 * The game type only changes the frontend UI and input method.
 */

export type GameType = "word-guess" | "lucky-number" | "trivia";

export interface GameTypeConfig {
  id: GameType;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  color: string;
  colorLight: string;
  bg: string;
  border: string;
  gradient: string;
  howToPlay: string[];
}

export const GAME_TYPES: Record<GameType, GameTypeConfig> = {
  "word-guess": {
    id: "word-guess",
    name: "Word Guess",
    tagline: "Crack the Code",
    description:
      "Guess the secret word encrypted on-chain. Your submission is protected by Arcium encryption before it hits the chain.",
    emoji: "🔤",
    color: "text-accent-purple",
    colorLight: "text-accent-violet",
    bg: "bg-accent-purple/10",
    border: "border-accent-purple/20",
    gradient: "from-accent-purple to-accent-violet",
    howToPlay: [
      "Pay the entry fee in SOL (or swap via Jupiter)",
      "Type your word guess — it gets encrypted via Arcium",
      "SHA-256 hash comparison decides the winner on-chain",
      "Winner takes the entire pot + earns an NFT trophy",
    ],
  },
  "lucky-number": {
    id: "lucky-number",
    name: "Lucky Number",
    tagline: "Pick Your Fortune",
    description:
      "Choose a number from 1–100. One lucky number wins the entire pot. Simple, thrilling, fully on-chain.",
    emoji: "🎰",
    color: "text-accent-cyan",
    colorLight: "text-accent-teal",
    bg: "bg-accent-cyan/10",
    border: "border-accent-cyan/20",
    gradient: "from-accent-cyan to-accent-teal",
    howToPlay: [
      "Pay the entry fee in SOL to join a round",
      "Click a number on the 1–100 grid to pick your guess",
      "Your number is hashed and compared on-chain",
      "Match the secret number to win the full pot!",
    ],
  },
  trivia: {
    id: "trivia",
    name: "Trivia Challenge",
    tagline: "Test Your Knowledge",
    description:
      "Answer knowledge questions to win SOL. Questions span crypto, science, history, and more.",
    emoji: "🧠",
    color: "text-accent-amber",
    colorLight: "text-accent-amber",
    bg: "bg-accent-amber/10",
    border: "border-accent-amber/20",
    gradient: "from-accent-amber to-orange-400",
    howToPlay: [
      "Pay the entry fee to enter a trivia round",
      "Read the question and choose from 4 answers",
      "Your answer is hashed and verified on-chain",
      "First correct answer wins the pot!",
    ],
  },
};

/** Trivia question data — stored client-side, answer verified on-chain via hash */
export interface TriviaQuestion {
  question: string;
  options: string[];
  // The correct answer is NOT stored here — only on-chain as a SHA-256 hash
  category: string;
}

/**
 * Maps round IDs to game types.
 * Updated when creating rounds via the create-round script.
 * Rounds not in this map default to 'word-guess'.
 */
export const ROUND_GAME_TYPES: Record<number, GameType> = {
  // Rounds 0-4: default to word-guess
  5: "lucky-number",
  6: "trivia",
  7: "word-guess",
  8: "lucky-number",
  9: "trivia",
};

/**
 * Maps round IDs to trivia questions (for trivia rounds).
 * The answer text is hashed on-chain — the question is client-side metadata.
 */
export const TRIVIA_QUESTIONS: Record<number, TriviaQuestion> = {
  6: {
    question: "What is the native token of the Solana blockchain?",
    options: ["Ethereum", "Solana (SOL)", "Bitcoin", "Cardano"],
    category: "Crypto",
  },
  9: {
    question: "Which NFT standard uses single-account assets on Solana?",
    options: ["Token Metadata", "Metaplex Core", "Candy Machine", "Token-2022"],
    category: "Crypto",
  },
};

/** Get game type for a round, defaulting to word-guess */
export function getRoundGameType(roundId: number): GameType {
  return ROUND_GAME_TYPES[roundId] ?? "word-guess";
}

/** Get trivia question for a round */
export function getTriviaQuestion(roundId: number): TriviaQuestion | null {
  return TRIVIA_QUESTIONS[roundId] ?? null;
}

/** Count active rounds by game type */
export function countRoundsByGameType(
  rounds: { account: { id: number; isActive: boolean; expiresAt: number } }[]
): Record<GameType, number> {
  const now = Math.floor(Date.now() / 1000);
  const counts: Record<GameType, number> = {
    "word-guess": 0,
    "lucky-number": 0,
    trivia: 0,
  };

  for (const r of rounds) {
    if (r.account.isActive && r.account.expiresAt > now) {
      const type = getRoundGameType(r.account.id);
      counts[type]++;
    }
  }

  return counts;
}
