"use client";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { GAME_TYPES, countRoundsByGameType, type GameType } from "@/lib/gameTypes";
import type { RoundWithKey } from "@/hooks/useGame";

interface PortalHubProps {
  rounds: RoundWithKey[];
  onSelectGame: (game: GameType) => void;
  totalWinnings?: number;
  userWins?: number;
}

const gameOrder: GameType[] = ["word-guess", "lucky-number", "trivia"];

export default function PortalHub({
  rounds,
  onSelectGame,
  totalWinnings = 0,
  userWins = 0,
}: PortalHubProps) {
  const counts = countRoundsByGameType(rounds);
  const now = Math.floor(Date.now() / 1000);
  const totalActive = rounds.filter(
    (r) => r.account.isActive && r.account.expiresAt > now
  ).length;
  const totalPot = rounds
    .filter((r) => r.account.isActive && r.account.expiresAt > now)
    .reduce((sum, r) => sum + r.account.potLamports, 0);

  return (
    <div className="space-y-6">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-card">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/[0.08] via-transparent to-accent-cyan/[0.06]" />
        <div className="absolute top-[-50%] right-[-20%] w-[400px] h-[400px] rounded-full bg-accent-purple/[0.05] blur-[80px]" />
        <div className="absolute bottom-[-40%] left-[-10%] w-[300px] h-[300px] rounded-full bg-accent-cyan/[0.04] blur-[60px]" />

        <div className="relative px-8 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-accent-purple/10 text-accent-violet border border-accent-purple/20 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple animate-pulse" />
                Multi-Game Arena
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-3">
                Choose Your{" "}
                <span className="bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-teal bg-clip-text text-transparent">
                  Arena
                </span>
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-lg leading-relaxed">
                Three on-chain games powered by a single Anchor smart contract.
                Every guess is encrypted, every win earns an NFT.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-accent-green">
                  {(totalPot / LAMPORTS_PER_SOL).toFixed(2)}
                </p>
                <p className="text-[11px] text-text-dim uppercase tracking-wider mt-0.5">
                  SOL in Pots
                </p>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-accent-cyan">
                  {totalActive}
                </p>
                <p className="text-[11px] text-text-dim uppercase tracking-wider mt-0.5">
                  Active Rounds
                </p>
              </div>
              <div className="w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold font-mono text-accent-purple">
                  {rounds.length}
                </p>
                <p className="text-[11px] text-text-dim uppercase tracking-wider mt-0.5">
                  Total Games
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Game Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {gameOrder.map((key) => {
          const game = GAME_TYPES[key];
          const activeCount = counts[key];
          const isAvailable = true; // All games available

          return (
            <button
              key={key}
              onClick={() => onSelectGame(key)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-bg-card hover:border-border-light transition-all duration-300 text-left"
            >
              {/* Top gradient accent */}
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${game.gradient} opacity-60 group-hover:opacity-100 transition-opacity`}
              />

              {/* Hover glow */}
              <div
                className={`absolute inset-0 ${game.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />

              <div className="relative p-6 sm:p-7">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div
                    className={`text-4xl group-hover:scale-110 transition-transform duration-300`}
                  >
                    {game.emoji}
                  </div>
                  {activeCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                      {activeCount} live
                    </span>
                  )}
                  {activeCount === 0 && (
                    <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full bg-bg-elevated text-text-dim border border-border">
                      No rounds
                    </span>
                  )}
                </div>

                {/* Title & description */}
                <h3
                  className={`text-lg font-bold text-text-primary mb-1 group-hover:${game.color} transition-colors`}
                >
                  {game.name}
                </h3>
                <p className="text-xs font-medium text-text-dim uppercase tracking-wider mb-3">
                  {game.tagline}
                </p>
                <p className="text-sm text-text-secondary leading-relaxed mb-6">
                  {game.description}
                </p>

                {/* How it works preview */}
                <div className="space-y-2 mb-6">
                  {game.howToPlay.slice(0, 2).map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-[12px] text-text-dim"
                    >
                      <span
                        className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${game.bg} ${game.color} text-[10px] font-bold mt-0.5`}
                      >
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {/* Play button */}
                <div
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${game.bg} border ${game.border} ${game.color} group-hover:shadow-lg`}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play Now
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Protocol Badges ── */}
      <div className="flex flex-wrap items-center justify-center gap-3 py-4">
        {[
          { label: "Anchor", color: "text-accent-purple" },
          { label: "Jupiter", color: "text-accent-cyan" },
          { label: "Metaplex Core", color: "text-accent-amber" },
          { label: "Arcium", color: "text-accent-violet" },
          { label: "Magicblock", color: "text-accent-green" },
        ].map((p) => (
          <span
            key={p.label}
            className={`text-[11px] font-medium px-3 py-1 rounded-full bg-bg-elevated border border-border ${p.color}`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
