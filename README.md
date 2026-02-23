# SolPot Arena

A multi-game on-chain arena on Solana featuring word guessing, lucky number picks, trivia challenges, and coin flip duels — with Jupiter swap entry, Arcium-style encrypted guesses, MagicBlock VRF randomness, Metaplex NFT rewards, Magicblock-pattern real-time updates, and dark/light mode.

## Features

- **Multi-Game Portal** — Four game modes powered by a single Anchor smart contract: Word Guess, Lucky Number (1–100 grid), Trivia Challenge, and Coin Flip (2-player VRF duel)
- **On-Chain Verification** — All answers stored as SHA-256 hashes on-chain; guesses are verified trustlessly by the Solana program
- **Pay-to-Play with Any Token** — Enter rounds with SOL directly, or swap any SPL token (USDC, BONK, etc.) via Jupiter in a single transaction
- **Winner-Takes-All Pot** — All entry fees pool into a PDA vault; the first correct guesser claims the entire pot (minus a small platform fee)
- **Encrypted Guesses** — Client-side x25519 ECDH key exchange + Arcium RescueCipher encryption protects guesses from mempool snooping
- **NFT Winner Trophies** — Winners receive a unique Metaplex NFT minted on-chain via CPI as proof of victory
- **Real-Time Leaderboard** — Live updates via Solana WebSocket subscriptions using the Magicblock pattern — no polling required
- **Player Stats & Achievements** — Track wins, win rate, SOL earned, and unlock achievement badges
- **Dark / Light Mode** — Toggle between dark and light themes, persisted via localStorage
- **Claim & Mint UI** — Winners can claim their prize and mint their NFT directly from the frontend with one-click buttons
- **Live Countdown Timers** — Real-time countdowns for each round with days/hours/minutes/seconds display
- **Multi-Wallet Support** — Works with Phantom, Solflare, Backpack, and other Solana wallets via Wallet Adapter
- **Standalone Jupiter Swap** — Devnet/Mainnet toggle swap panel independent of the game
- **Fully Permissionless** — Pot distribution and NFT minting are permissionless instructions — anyone can trigger them once a winner is determined
- **Devnet Ready** — Deployed and playable on Solana devnet with automated round creation scripts

## Game Modes

### 🔤 Word Guess
Guess the secret word encrypted on-chain. Your submission is protected by Arcium encryption before it hits the chain.

### 🎰 Lucky Number
Pick a number from 1–100 on an interactive grid. One lucky number wins the entire pot.

### 🧠 Trivia Challenge
Answer knowledge questions spanning crypto, science, history, and more. Choose from 4 options — first correct answer wins!

### 🪙 Coin Flip
2-player head-to-head coin flip powered by MagicBlock VRF. Both players enter, the coin flips with verifiable randomness — winner takes the entire pot.

> All four modes use the **same deployed Solana program** — the contract stores SHA-256 hashes and compares text guesses. The game type only changes the frontend input UI. Coin Flip adds MagicBlock VRF for on-chain verifiable randomness.

## Game Flow

1. **Admin initializes** the game with entry fee and fee percentage
2. **Admin creates a round** with a SHA-256 hash of the secret answer + game type metadata
3. **Players connect wallet** and choose a game mode from the Portal Hub (Word Guess, Lucky Number, Trivia, or Coin Flip)
4. **Players enter** by paying the entry fee (SOL or any SPL token via Jupiter swap)
5. **Players submit guesses** — word input, number grid click, trivia option selection, or coin flip
6. **First correct guess wins** — round closes, winner is recorded (Coin Flip uses MagicBlock VRF)
7. **Pot is distributed** — winner receives pot minus protocol fee
8. **NFT trophy minted** to the winner via Metaplex Token Metadata CPI
9. **Leaderboard & stats update** in real-time via WebSocket subscriptions

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| On-chain program | Anchor 0.30.1 | Game logic, vault, PDA accounts |
| Token swap | Jupiter Metis API | Any SPL token → SOL entry |
| NFT rewards | Metaplex Token Metadata | Winner trophy NFTs (CPI) |
| Encryption | Arcium SDK (x25519 + RescueCipher) | Confidential guess encryption |
| VRF Randomness | MagicBlock VRF | Verifiable coin flip randomness |
| Real-time | Magicblock pattern (Solana WebSocket) | Live leaderboard updates |
| Frontend | Next.js 14, TypeScript, Tailwind CSS | Multi-game portal UI |
| Wallet | Solana Wallet Adapter | Phantom, Solflare, Backpack |

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.18+)
- [Anchor](https://www.anchor-lang.com/docs/installation) (v0.30.1)
- [Node.js](https://nodejs.org/) (v18+)
- [Yarn](https://yarnpkg.com/) or npm

## Setup & Deployment

### 1. Configure Solana CLI for devnet

```bash
solana config set --url devnet
solana-keygen new   # if you don't have a keypair
solana airdrop 5    # get devnet SOL
```

### 2. Build & deploy the Anchor program

```bash
cd anchor
yarn install
anchor build
```

After building, update the program ID:

```bash
anchor keys list
# Copy the program ID and update:
# - anchor/Anchor.toml  → [programs.devnet] solpot = "YOUR_ID"
# - anchor/programs/solpot/src/lib.rs → declare_id!("YOUR_ID")
# - app/.env → NEXT_PUBLIC_PROGRAM_ID=YOUR_ID
anchor build   # rebuild with correct ID
anchor deploy
```

### 3. Run tests

```bash
cd anchor
anchor test
```

### 4. Set up the frontend

```bash
cd app
cp .env.example .env
# Edit .env with your program ID and optional Jupiter API key
npm install
npm run dev
```

### 5. Initialize the game (one-time admin action)

Use the Anchor CLI or a script to call `initialize_game`:

```bash
cd anchor
anchor run test
```

### 6. Create rounds

Use the `create-round` script with game type support:

```bash
cd app

# Word Guess round (default)
npx tsx scripts/create-round.ts word "ocean"

# Lucky Number round (1-100)
npx tsx scripts/create-round.ts number 42

# Trivia Challenge round
npx tsx scripts/create-round.ts trivia "Solana (SOL)" \
  "What is the native token of the Solana blockchain?" \
  "Ethereum,Solana (SOL),Bitcoin,Cardano" \
  "Crypto"

# Coin Flip round (2-player max, answer = "heads" or "tails")
npx tsx scripts/create-round.ts word "heads"
```

After creating a round, add the round-to-game-type mapping in `src/lib/gameTypes.ts`:

```typescript
// In ROUND_GAME_TYPES:
5: "lucky-number",
6: "trivia",

// For trivia rounds, also add to TRIVIA_QUESTIONS:
6: {
  question: "What is the native token of the Solana blockchain?",
  options: ["Ethereum", "Solana (SOL)", "Bitcoin", "Cardano"],
  category: "Crypto",
},
```

## Project Structure

```
anchor/              — Solana program (Anchor 0.30.1)
  programs/solpot/   — Smart contract source
  tests/             — Integration tests
app/                 — Next.js 14 frontend
  src/
    app/             — Pages, layout, global CSS
    components/      — UI components
      PortalHub      — Game selection hub
      GameBoard      — Per-game-type arena + history
      LuckyNumberGame— 10×10 number grid picker
      TriviaGame     — Multiple-choice answer cards
      GuessForm      — Word guess text input
      CoinFlipGame   — 2-player VRF coin flip
      RoundInfo      — Round stats + countdown timer
      JupiterSwap    — Round entry with token swap
      SwapPanel      — Standalone Jupiter swap modal
      PlayerStats    — Wins, earnings, achievements
      Leaderboard    — Top 50 winners (WebSocket)
      NFTDisplay     — Winner NFT collection
    hooks/           — useGame, useLeaderboard
    lib/             — Program helpers, types, constants, gameTypes
  scripts/           — create-round, init-game CLI tools
```

## Environment Variables

Create `app/.env` from `app/.env.example`:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_RPC_URL` | Solana RPC endpoint | Yes |
| `NEXT_PUBLIC_PROGRAM_ID` | Deployed program ID | Yes |
| `NEXT_PUBLIC_JUPITER_API_KEY` | Jupiter API key (from portal.jup.ag) | For swaps |
| `NEXT_PUBLIC_WS_URL` | WebSocket RPC for real-time | Yes |

## Security

- **No admin backdoor** — PDA-controlled vaults, no central authority override
- **No hardcoded keys** — all secrets via environment variables
- **Checked arithmetic** — all math uses `checked_*` operations
- **No unsafe unwrap()** — proper error propagation throughout
- **Signer verification** — all instructions verify caller authority
- **PDA seed isolation** — unique PDAs per round, per player
- **Replay protection** — one PlayerEntry per player per round (PDA uniqueness)
- **Hash-based privacy** — secret answers stored as SHA-256 hash (irreversible)
- **Transport encryption** — x25519 ECDH key exchange + Arcium RescueCipher

## On-Chain Accounts

| Account | Seeds | Purpose |
|---------|-------|---------|
| GameConfig | `["game_config"]` | Global game settings |
| Leaderboard | `["leaderboard", game_config]` | Top 50 winners |
| Round | `["round", game_config, round_id]` | Round state + SOL vault |
| PlayerEntry | `["player_entry", round, player]` | Entry proof (one per player per round) |

## Built By

[@sambitsargam](https://x.com/sambitsargam)

## License

MIT