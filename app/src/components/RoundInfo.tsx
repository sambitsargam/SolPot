"use client";

import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import type { RoundWithKey } from "@/hooks/useGame";

interface RoundInfoProps {
  round: RoundWithKey;
}

export default function RoundInfo({ round }: RoundInfoProps) {
  const { account } = round;
  const potSOL = account.potLamports / LAMPORTS_PER_SOL;
  const entryFeeSOL = account.entryFeeLamports / LAMPORTS_PER_SOL;
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = Math.max(0, account.expiresAt - now);
  const isExpired = timeLeft === 0;

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isWinnerDefault =
    account.winner.toBase58() === PublicKey.default.toBase58();

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-text-primary">Round #{account.id}</h3>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
              account.isActive
                ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                : account.hasWinner
                ? "bg-accent-amber/10 text-accent-amber border border-accent-amber/20"
                : "bg-bg-elevated text-text-dim border border-border"
            }`}
          >
            {account.isActive
              ? "Active"
              : account.hasWinner
              ? "Won"
              : "Closed"}
          </span>
        </div>
        {account.isActive && !isExpired && (
          <span className="text-sm text-text-secondary font-mono">
            {formatTime(timeLeft)} left
          </span>
        )}
        {isExpired && account.isActive && (
          <span className="text-sm text-red-400">Expired</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Pot */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Pot Size</p>
          <p className="text-xl font-bold text-accent-green font-mono">
            {potSOL.toFixed(3)}
          </p>
          <p className="text-[11px] text-text-dim">SOL</p>
        </div>

        {/* Players */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Players</p>
          <p className="text-xl font-bold text-text-primary font-mono">
            {account.playerCount}
            <span className="text-sm text-text-dim">
              /{account.maxPlayers}
            </span>
          </p>
        </div>

        {/* Entry Fee */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Entry Fee</p>
          <p className="text-xl font-bold text-text-primary font-mono">{entryFeeSOL.toFixed(3)}</p>
          <p className="text-[11px] text-text-dim">SOL</p>
        </div>

        {/* Status */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Status</p>
          {account.hasWinner && !isWinnerDefault ? (
            <div>
              <p className="text-sm font-bold text-accent-amber">Winner!</p>
              <p className="text-[11px] text-text-dim font-mono truncate">
                {account.winner.toBase58().slice(0, 8)}...
              </p>
            </div>
          ) : account.potDistributed ? (
            <p className="text-sm text-text-muted">Distributed</p>
          ) : (
            <p className="text-sm text-accent-green">
              {account.isActive ? "Guessing" : "Finished"}
            </p>
          )}
        </div>
      </div>

      {/* NFT Status */}
      {account.hasWinner && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
              account.nftMinted
                ? "bg-accent-purple/10 text-accent-violet border border-accent-purple/20"
                : "bg-bg-elevated text-text-dim border border-border"
            }`}
          >
            NFT: {account.nftMinted ? "Minted" : "Pending"}
          </span>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
              account.potDistributed
                ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                : "bg-bg-elevated text-text-dim border border-border"
            }`}
          >
            Pot: {account.potDistributed ? "Distributed" : "Pending"}
          </span>
        </div>
      )}
    </div>
  );
}
