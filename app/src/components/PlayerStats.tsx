"use client";

import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import type { RoundWithKey } from "@/hooks/useGame";
import type { GameConfigAccount } from "@/lib/types";

interface PlayerStatsProps {
  rounds: RoundWithKey[];
  gameConfig: GameConfigAccount | null;
}

export default function PlayerStats({ rounds, gameConfig }: PlayerStatsProps) {
  const { publicKey } = useWallet();

  if (!publicKey) {
    return (
      <div className="card-glass p-5">
        <h3 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-accent-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          Player Stats
        </h3>
        <p className="text-text-dim text-sm text-center py-4">
          Connect wallet to see stats
        </p>
      </div>
    );
  }

  const walletStr = publicKey.toBase58();

  // Calculate player stats from round data
  const completedRounds = rounds.filter(
    (r) => !r.account.isActive || r.account.expiresAt <= Math.floor(Date.now() / 1000)
  );

  const wins = completedRounds.filter((r) => {
    try {
      return (
        r.account.hasWinner &&
        r.account.winner.toBase58() === walletStr
      );
    } catch {
      return false;
    }
  });

  const totalWinnings = wins.reduce(
    (sum, r) => sum + r.account.playerCount * r.account.entryFeeLamports,
    0
  );

  const winRate =
    completedRounds.length > 0
      ? ((wins.length / completedRounds.length) * 100).toFixed(1)
      : "0.0";

  const nftCount = wins.filter((r) => r.account.nftMinted).length;

  // Current active rounds the player might be in
  const now = Math.floor(Date.now() / 1000);
  const activeRounds = rounds.filter(
    (r) => r.account.isActive && r.account.expiresAt > now
  );

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          Player Stats
        </h3>
        <span className="text-[11px] font-mono text-text-dim">
          {walletStr.slice(0, 4)}...{walletStr.slice(-4)}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">
            Wins
          </p>
          <p className="text-xl font-bold text-accent-green font-mono">
            {wins.length}
          </p>
        </div>
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">
            Win Rate
          </p>
          <p className="text-xl font-bold text-accent-cyan font-mono">
            {winRate}%
          </p>
        </div>
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">
            Earned
          </p>
          <p className="text-xl font-bold text-accent-amber font-mono">
            {(totalWinnings / LAMPORTS_PER_SOL).toFixed(3)}
          </p>
          <p className="text-[10px] text-text-dim">SOL</p>
        </div>
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">
            NFTs
          </p>
          <p className="text-xl font-bold text-accent-violet font-mono">
            {nftCount}
          </p>
          <p className="text-[10px] text-text-dim">Trophies</p>
        </div>
      </div>

      {/* Achievement badges */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-text-dim mb-1.5">
          Achievements
        </p>
        {wins.length >= 1 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-amber/5 border border-accent-amber/10">
            <span className="text-sm">🏆</span>
            <div>
              <p className="text-[12px] font-medium text-accent-amber">
                First Win
              </p>
              <p className="text-[10px] text-text-dim">Won your first round</p>
            </div>
          </div>
        )}
        {wins.length >= 5 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-purple/5 border border-accent-purple/10">
            <span className="text-sm">⚡</span>
            <div>
              <p className="text-[12px] font-medium text-accent-violet">
                Veteran
              </p>
              <p className="text-[10px] text-text-dim">Won 5 rounds</p>
            </div>
          </div>
        )}
        {nftCount >= 1 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-cyan/5 border border-accent-cyan/10">
            <span className="text-sm">🎨</span>
            <div>
              <p className="text-[12px] font-medium text-accent-cyan">
                Collector
              </p>
              <p className="text-[10px] text-text-dim">
                Collected your first NFT trophy
              </p>
            </div>
          </div>
        )}
        {totalWinnings >= 1 * LAMPORTS_PER_SOL && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-green/5 border border-accent-green/10">
            <span className="text-sm">💰</span>
            <div>
              <p className="text-[12px] font-medium text-accent-green">
                Big Winner
              </p>
              <p className="text-[10px] text-text-dim">
                Earned over 1 SOL total
              </p>
            </div>
          </div>
        )}
        {wins.length === 0 && nftCount === 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-bg-elevated border border-border">
            <span className="text-sm">🎮</span>
            <div>
              <p className="text-[12px] font-medium text-text-muted">
                Getting Started
              </p>
              <p className="text-[10px] text-text-dim">
                Win your first round to unlock achievements
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
