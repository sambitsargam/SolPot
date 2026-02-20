"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const GameBoard = dynamic(() => import("@/components/GameBoard"), {
  ssr: false,
});
const Leaderboard = dynamic(() => import("@/components/Leaderboard"), {
  ssr: false,
});
const NFTDisplay = dynamic(() => import("@/components/NFTDisplay"), {
  ssr: false,
});
const SwapPanel = dynamic(() => import("@/components/SwapPanel"), {
  ssr: false,
});

/* ─── Icon Components ───────────────────────────────────────────── */

function IconSwap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path
        d="M7 10l5-5m0 0l5 5m-5-5v14"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-40"
      />
      <path
        d="M17 14l-5 5m0 0l-5-5m5 5V5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path
        d="M8 21h8m-4-4v4M6 4h12M6 4a2 2 0 00-2 2v1a5 5 0 005 5h0M6 4V3m12 1a2 2 0 012 2v1a5 5 0 01-5 5h0m5-7V3m-7 9a4 4 0 01-4-4V4h8v4a4 4 0 01-4 4z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path
        d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCube() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <path
        d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Feature Data ──────────────────────────────────────────────── */

const features = [
  {
    icon: <IconSwap />,
    title: "Jupiter DEX Swap",
    description:
      "Enter rounds with any SPL token. Jupiter aggregates the best swap route to SOL automatically — no manual conversion needed.",
    color: "text-accent-cyan",
    bg: "bg-accent-cyan/10",
    borderColor: "border-accent-cyan/20",
    tag: "DeFi Integration",
  },
  {
    icon: <IconShield />,
    title: "Arcium Encryption",
    description:
      "Your guess is encrypted client-side with X25519 key exchange and XChaCha20-Poly1305 before hitting the chain. Nobody sees your word.",
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
    borderColor: "border-accent-purple/20",
    tag: "Privacy Layer",
  },
  {
    icon: <IconTrophy />,
    title: "Metaplex NFT Trophies",
    description:
      "Winners receive a unique on-chain NFT minted via Metaplex Token Metadata. Collect trophies per round — proof of your wins forever.",
    color: "text-accent-amber",
    bg: "bg-accent-amber/10",
    borderColor: "border-accent-amber/20",
    tag: "On-chain Rewards",
  },
  {
    icon: <IconBolt />,
    title: "Magicblock Real-time",
    description:
      "Live leaderboard updates via WebSocket subscriptions using the Magicblock pattern. See new entries and winners as they happen.",
    color: "text-accent-green",
    bg: "bg-accent-green/10",
    borderColor: "border-accent-green/20",
    tag: "Live Updates",
  },
  {
    icon: <IconKey />,
    title: "Commit-Reveal Scheme",
    description:
      "Encrypted guesses are stored on-chain as commitments. The authority reveals the answer to distribute the pot — MEV resistant.",
    color: "text-accent-violet",
    bg: "bg-accent-violet/10",
    borderColor: "border-accent-violet/20",
    tag: "Game Theory",
  },
  {
    icon: <IconCube />,
    title: "Anchor Program",
    description:
      "Battle-tested Anchor smart contract managing game config, rounds, pot distribution, fee collection, and NFT minting — all on-chain.",
    color: "text-accent-teal",
    bg: "bg-accent-teal/10",
    borderColor: "border-accent-teal/20",
    tag: "Smart Contract",
  },
];

const steps = [
  {
    num: "01",
    title: "Connect Wallet",
    desc: "Link your Phantom or Solflare wallet to get started on Solana devnet.",
  },
  {
    num: "02",
    title: "Enter a Round",
    desc: "Pay the entry fee in SOL or swap any token via Jupiter to join an active round.",
  },
  {
    num: "03",
    title: "Submit Your Guess",
    desc: "Type your word. It gets encrypted with Arcium and stored on-chain as a commitment.",
  },
  {
    num: "04",
    title: "Win the Pot",
    desc: "Guess correctly to win the entire pot and earn a Metaplex NFT trophy.",
  },
];

/* ─── Page Component ────────────────────────────────────────────── */

export default function Home() {
  const { connected } = useWallet();
  const [activeFeature, setActiveFeature] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showSwap, setShowSwap] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Prevent hydration mismatch — wallet state not known during SSR
  if (!mounted) {
    return (
      <main className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="inline-flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
          <span className="text-text-secondary text-sm">Loading...</span>
        </div>
      </main>
    );
  }

  if (connected) {
    return (
      <main className="min-h-screen bg-bg-primary">
        {/* Swap Modal */}
        {showSwap && <SwapPanel onClose={() => setShowSwap(false)} />}

        {/* Connected Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan opacity-80" />
                <div className="relative w-full h-full rounded-lg flex items-center justify-center font-bold text-sm tracking-tight">
                  SP
                </div>
              </div>
              <span className="font-semibold text-text-primary tracking-tight">
                SolPot<span className="text-accent-purple">Arena</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Swap Button */}
              <button
                onClick={() => setShowSwap(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/30 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                Swap
              </button>
              <span className="badge-green">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                Devnet
              </span>
              <WalletMultiButtonDynamic />
            </div>
          </div>
        </header>

        {/* Connected Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <GameBoard />
            </div>
            <div className="space-y-6">
              <Leaderboard />
              <NFTDisplay />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-primary overflow-hidden">
      {/* ── Background Layers ── */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Grid */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100" />
        {/* Radial glow */}
        <div className="absolute inset-0 bg-radial-hero" />
        {/* Accent blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent-purple/[0.07] blur-[120px]" />
        <div className="absolute top-[10%] right-[-15%] w-[500px] h-[500px] rounded-full bg-accent-cyan/[0.05] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-accent-teal/[0.04] blur-[100px]" />
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-50 border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan" />
              <div className="relative w-full h-full rounded-lg flex items-center justify-center font-bold text-sm tracking-tight">
                SP
              </div>
            </div>
            <span className="font-semibold text-lg text-text-primary tracking-tight">
              SolPot<span className="text-accent-purple">Arena</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
            <a href="#features" className="hover:text-text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-text-primary transition-colors">
              How it Works
            </a>
            <a href="#tech" className="hover:text-text-primary transition-colors">
              Tech Stack
            </a>
          </div>

          <div className="flex items-center gap-3">
            <span className="badge-green hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              Devnet
            </span>
            <WalletMultiButtonDynamic />
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left: Copy */}
          <div className="flex-1 max-w-xl">
            <div className="badge-purple mb-6 opacity-0 animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse" />
              Live on Solana Devnet
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6 opacity-0 animate-fade-up">
              Guess the word.
              <br />
              <span className="text-gradient">Win the pot.</span>
            </h1>

            <p className="text-lg text-text-secondary leading-relaxed mb-8 max-w-md opacity-0 animate-fade-up-delayed">
              An on-chain word game where your guess is encrypted, your entry is
              swapped via Jupiter, and your victory earns an NFT trophy.
            </p>

            <div className="flex flex-wrap items-center gap-4 opacity-0 animate-fade-up-delayed">
              <WalletMultiButtonDynamic />
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary border border-border hover:border-border-light px-5 py-2.5 rounded-xl transition-all"
              >
                How it works
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80">
              {/* Orbiting ring */}
              <div className="absolute inset-0 rounded-full border border-border-light/50 animate-spin-slow" />
              <div className="absolute inset-4 rounded-full border border-accent-purple/20" />
              <div className="absolute inset-8 rounded-full border border-accent-cyan/10" />

              {/* Center piece */}
              <div className="absolute inset-12 rounded-3xl bg-bg-card border border-border overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 via-transparent to-accent-cyan/10" />
                <div className="relative h-full flex flex-col items-center justify-center gap-3">
                  <span className="text-4xl font-bold text-gradient">SP</span>
                  <div className="flex gap-1.5">
                    {["S", "O", "L", "P", "O", "T"].map((letter, i) => (
                      <span
                        key={i}
                        className="w-6 h-7 rounded bg-bg-elevated border border-border flex items-center justify-center text-xs font-mono font-bold text-accent-violet"
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 animate-float">
                <div className="badge-cyan whitespace-nowrap shadow-lg shadow-accent-cyan/10">
                  <IconBolt />
                  Real-time
                </div>
              </div>
              <div className="absolute top-1/2 -right-4 -translate-y-1/2 animate-float-delayed">
                <div className="badge-purple whitespace-nowrap shadow-lg shadow-accent-purple/10">
                  <IconShield />
                  Encrypted
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 animate-float-slow">
                <div className="badge-green whitespace-nowrap shadow-lg shadow-accent-green/10">
                  <IconTrophy />
                  NFT Rewards
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="divider-glow" />
      </div>

      {/* ── Features Section ── */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <span className="badge-purple mb-4">
            Core Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4">
            Built with the <span className="text-gradient">best of Solana</span>
          </h2>
          <p className="text-text-secondary mt-4 max-w-lg mx-auto">
            Six protocol integrations working together to create a secure,
            fair, and rewarding on-chain gaming experience.
          </p>
        </div>

        {/* Feature grid — Desktop: left list + right detail, Mobile: cards */}
        <div className="hidden lg:grid grid-cols-5 gap-8">
          {/* Left: feature list */}
          <div className="col-span-2 space-y-2">
            {features.map((f, i) => (
              <button
                key={i}
                onClick={() => setActiveFeature(i)}
                className={`w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                  activeFeature === i
                    ? "bg-bg-card border border-border-light"
                    : "hover:bg-bg-card/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      activeFeature === i
                        ? `${features[i].bg} ${features[i].color}`
                        : "bg-bg-elevated text-text-muted group-hover:text-text-secondary"
                    }`}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium transition-colors ${
                        activeFeature === i
                          ? "text-text-primary"
                          : "text-text-secondary group-hover:text-text-primary"
                      }`}
                    >
                      {f.title}
                    </p>
                    <p className="text-xs text-text-dim mt-0.5">{f.tag}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right: active feature detail */}
          <div className="col-span-3">
            <div className="card-glass p-8 h-full relative overflow-hidden">
              <div
                className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 ${features[activeFeature].bg}`}
              />
              <div className="relative">
                <div
                  className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full mb-6 ${features[activeFeature].bg} ${features[activeFeature].color} border ${features[activeFeature].borderColor}`}
                >
                  {features[activeFeature].icon}
                  {features[activeFeature].tag}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-text-primary">
                  {features[activeFeature].title}
                </h3>
                <p className="text-text-secondary leading-relaxed text-[15px]">
                  {features[activeFeature].description}
                </p>

                {/* Visual detail per feature */}
                <div className="mt-8 p-4 rounded-xl bg-bg-primary/60 border border-border font-mono text-xs text-text-dim">
                  {activeFeature === 0 && (
                    <div className="space-y-1">
                      <p><span className="text-accent-cyan">jupiter</span>.swap({"{"}</p>
                      <p className="pl-4">inputMint: <span className="text-accent-amber">&quot;USDC&quot;</span>,</p>
                      <p className="pl-4">outputMint: <span className="text-accent-amber">&quot;SOL&quot;</span>,</p>
                      <p className="pl-4">amount: entryFee,</p>
                      <p className="pl-4">slippage: <span className="text-accent-green">50</span></p>
                      <p>{"}"})</p>
                    </div>
                  )}
                  {activeFeature === 1 && (
                    <div className="space-y-1">
                      <p><span className="text-accent-purple">const</span> encrypted = xchacha20poly1305(</p>
                      <p className="pl-4">sharedSecret,</p>
                      <p className="pl-4">nonce,</p>
                      <p className="pl-4"><span className="text-accent-amber">&quot;your_guess&quot;</span></p>
                      <p>)</p>
                      <p><span className="text-accent-purple">await</span> program.submitGuess(encrypted)</p>
                    </div>
                  )}
                  {activeFeature === 2 && (
                    <div className="space-y-1">
                      <p><span className="text-accent-amber">metaplex</span>.nfts().create({"{"}</p>
                      <p className="pl-4">name: <span className="text-accent-amber">&quot;SolPot Winner #42&quot;</span>,</p>
                      <p className="pl-4">symbol: <span className="text-accent-amber">&quot;SOLPOT&quot;</span>,</p>
                      <p className="pl-4">sellerFeeBasisPoints: <span className="text-accent-green">0</span></p>
                      <p>{"}"})</p>
                    </div>
                  )}
                  {activeFeature === 3 && (
                    <div className="space-y-1">
                      <p>connection.<span className="text-accent-green">onAccountChange</span>(</p>
                      <p className="pl-4">leaderboardPDA,</p>
                      <p className="pl-4">(account) =&gt; updateUI(account),</p>
                      <p className="pl-4"><span className="text-accent-amber">&quot;confirmed&quot;</span></p>
                      <p>)</p>
                    </div>
                  )}
                  {activeFeature === 4 && (
                    <div className="space-y-1">
                      <p><span className="text-accent-violet">// Phase 1: Commit</span></p>
                      <p>submitGuess(encrypted_hash)</p>
                      <p className="text-accent-violet">// Phase 2: Reveal</p>
                      <p>distributePot(secret_word)</p>
                      <p className="text-accent-violet">// Winner gets full pot</p>
                    </div>
                  )}
                  {activeFeature === 5 && (
                    <div className="space-y-1">
                      <p><span className="text-accent-teal">#[program]</span></p>
                      <p><span className="text-accent-teal">mod</span> solpot {"{"}</p>
                      <p className="pl-4">initialize_game()</p>
                      <p className="pl-4">create_round()</p>
                      <p className="pl-4">enter_round()</p>
                      <p className="pl-4">submit_guess()</p>
                      <p className="pl-4">distribute_pot()</p>
                      <p className="pl-4">mint_reward_nft()</p>
                      <p>{"}"}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: simple cards */}
        <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className="card-interactive p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${f.bg} ${f.color}`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-text-primary mb-1.5">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <span className="badge-cyan mb-4">Gameplay</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4">
            Four steps to <span className="text-gradient">victory</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+32px)] w-[calc(100%-32px)] h-px bg-gradient-to-r from-border-light to-transparent" />
              )}
              <div className="card-interactive p-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bg-elevated border border-border group-hover:border-accent-purple/30 transition-colors mb-4">
                  <span className="text-lg font-bold font-mono text-gradient">
                    {step.num}
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section id="tech" className="relative z-10 max-w-6xl mx-auto px-6 py-28">
        <div className="divider-glow mb-28" />

        <div className="text-center mb-16">
          <span className="badge-green mb-4">Infrastructure</span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-4">
            Powered by <span className="text-gradient">five protocols</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            {
              name: "Anchor",
              role: "Smart Contract",
              color: "text-accent-purple",
            },
            {
              name: "Jupiter",
              role: "DEX Aggregator",
              color: "text-accent-cyan",
            },
            {
              name: "Metaplex",
              role: "NFT Standard",
              color: "text-accent-amber",
            },
            {
              name: "Arcium",
              role: "Encryption",
              color: "text-accent-violet",
            },
            {
              name: "Magicblock",
              role: "Real-time",
              color: "text-accent-green",
            },
          ].map((tech) => (
            <div
              key={tech.name}
              className="card-interactive p-5 text-center group"
            >
              <p className={`font-semibold ${tech.color} mb-1`}>{tech.name}</p>
              <p className="text-xs text-text-dim">{tech.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-28">
        <div className="card-glass p-12 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/[0.06] via-transparent to-accent-cyan/[0.06]" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to play?
            </h2>
            <p className="text-text-secondary max-w-md mx-auto mb-8">
              Connect your wallet, enter a round, and test your word game
              skills on Solana.
            </p>
            <WalletMultiButtonDynamic />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/50 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-dim">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-accent-purple to-accent-cyan" />
            <span>SolPot Arena</span>
          </div>
          <p>
            Anchor &middot; Jupiter &middot; Metaplex &middot; Arcium &middot;
            Magicblock
          </p>
        </div>
      </footer>
    </main>
  );
}
