"use client";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useLeaderboard } from "@/hooks/useLeaderboard";

export default function Leaderboard() {
  const { entries, loading, refresh } = useLeaderboard();

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
          Leaderboard
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
        </h3>
        <button
          onClick={refresh}
          className="text-[11px] text-text-dim hover:text-accent-cyan bg-bg-elevated px-2.5 py-1 rounded-lg border border-border hover:border-border-light transition-all"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-bg-elevated rounded-xl p-3 animate-pulse h-14 border border-border"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-bg-elevated border border-border flex items-center justify-center">
            <svg className="w-5 h-5 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-text-muted text-sm">No winners yet</p>
          <p className="text-text-dim text-xs mt-1">
            Be the first to guess correctly!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.player.toBase58()}
              className="bg-bg-elevated rounded-xl p-3 flex items-center justify-between border border-border hover:border-border-light transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                    index === 0
                      ? "bg-accent-amber/10 text-accent-amber border border-accent-amber/20"
                      : index === 1
                      ? "bg-gray-400/10 text-gray-300 border border-gray-400/20"
                      : index === 2
                      ? "bg-orange-400/10 text-orange-400 border border-orange-400/20"
                      : "bg-bg-card text-text-dim border border-border"
                  }`}
                >
                  {index + 1}
                </div>

                {/* Player address */}
                <div>
                  <p className="text-sm font-mono text-text-primary">
                    {entry.player.toBase58().slice(0, 4)}...
                    {entry.player.toBase58().slice(-4)}
                  </p>
                  <p className="text-[11px] text-text-dim">
                    {entry.wins} win{entry.wins !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Winnings */}
              <div className="text-right">
                <p className="text-sm font-bold text-accent-green font-mono">
                  {(entry.totalWinnings / LAMPORTS_PER_SOL).toFixed(3)}
                </p>
                <p className="text-[11px] text-text-dim">SOL</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Real-time indicator */}
      <div className="mt-4 flex items-center gap-2 text-[11px] text-text-dim">
        <svg
          className="w-3 h-3 text-accent-green"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
            clipRule="evenodd"
          />
        </svg>
        WebSocket updates via Magicblock pattern
      </div>
    </div>
  );
}
