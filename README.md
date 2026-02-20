# SolPot Arena

A real-time, encrypted, on-chain word guessing game on Solana with Jupiter swap entry, Arcium-style encrypted guess validation, Metaplex NFT rewards, and Magicblock-pattern real-time leaderboard updates.

## Features

- **On-Chain Word Guessing** — Secret words stored as SHA-256 hashes on-chain; guesses are verified trustlessly by the Solana program
- **Pay-to-Play with Any Token** — Enter rounds with SOL directly, or swap any SPL token (USDC, BONK, etc.) via Jupiter in a single transaction
- **Winner-Takes-All Pot** — All entry fees pool into a PDA vault; the first correct guesser claims the entire pot (minus a small platform fee)
- **Encrypted Guesses** — Client-side X25519 key exchange + XChaCha20-Poly1305 AEAD encryption protects guesses from mempool snooping
- **NFT Winner Trophies** — Winners receive a unique Metaplex NFT minted on-chain via CPI as proof of victory
- **Real-Time Leaderboard** — Live updates via Solana WebSocket subscriptions using the Magicblock pattern — no polling required
- **Claim & Mint UI** — Winners can claim their prize and mint their NFT directly from the frontend with one-click buttons
- **Multi-Wallet Support** — Works with Phantom, Solflare, Backpack, and other Solana wallets via Wallet Adapter
- **Fully Permissionless** — Pot distribution and NFT minting are permissionless instructions — anyone can trigger them once a winner is determined
- **Devnet Ready** — Deployed and playable on Solana devnet with automated round creation scripts

## Game Flow

1. **Admin initializes** the game with entry fee and fee percentage
2. **Admin creates a round** with a SHA-256 hash of a secret word
3. **Players enter** by paying the entry fee (SOL or any SPL token via Jupiter swap)
4. **Players submit guesses** — the program hashes each guess and compares to the word hash
5. **First correct guess wins** — round closes, winner is recorded
6. **Pot is distributed** — winner receives pot minus protocol fee
7. **NFT trophy minted** to the winner via Metaplex Token Metadata CPI
8. **Leaderboard updates** in real-time via WebSocket subscriptions

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| On-chain program | Anchor 0.30.1 | Game logic, vault, PDA accounts |
| Token swap | Jupiter Metis API | Any SPL token → SOL entry |
| NFT rewards | Metaplex Token Metadata | Winner trophy NFTs (CPI) |
| Encryption | Arcium pattern (X25519 + XChaCha20-Poly1305) | Transport-layer guess privacy |
| Real-time | Magicblock pattern (Solana WebSocket) | Live leaderboard updates |
| Frontend | Next.js 14, TypeScript, Tailwind CSS | User interface |
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
# The test file includes initialization — or use anchor CLI:
anchor run test
```

### 6. Create a round

The admin creates a round by providing:
- SHA-256 hash of the secret word (lowercase)
- Maximum number of players
- Duration in seconds

To compute the word hash in JavaScript:
```javascript
const { createHash } = require('crypto');
const word = 'solana';
const hash = createHash('sha256').update(word).digest();
console.log(Array.from(hash)); // Use this as word_hash argument
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
- **Hash-based privacy** — secret word stored as SHA-256 hash (irreversible)
- **Transport encryption** — X25519 key exchange + XChaCha20-Poly1305 AEAD

## On-Chain Accounts

| Account | Seeds | Purpose |
|---------|-------|---------|
| GameConfig | `["game_config"]` | Global game settings |
| Leaderboard | `["leaderboard", game_config]` | Top 50 winners |
| Round | `["round", game_config, round_id]` | Round state + SOL vault |
| PlayerEntry | `["player_entry", round, player]` | Entry proof (one per player per round) |

## License

MIT