"use client";

import { useState, useCallback } from "react";
import { useGame, type RoundWithKey } from "@/hooks/useGame";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import RoundInfo from "./RoundInfo";
import GuessForm from "./GuessForm";
import JupiterSwap from "./JupiterSwap";

function ActiveRound({ round, refreshState }: { round: RoundWithKey; refreshState: () => Promise<void> }) {
  const [joined, setJoined] = useState(false);
  const onJoined = useCallback(() => setJoined(true), []);

  return (
    <div className="space-y-4">
      <RoundInfo round={round} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <JupiterSwap round={round} joined={joined} onJoined={onJoined} />
        <GuessForm round={round} joined={joined} onGuessSubmitted={refreshState} />
      </div>
    </div>
  );
}

export default function GameBoard() {
  const { gameConfig, rounds, loading, error, txPending, refreshState, distributePot, mintRewardNft } =
    useGame();

  if (loading) {
    return (
      <div className="card-glass p-10 text-center">
        <div className="inline-flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-accent-purple border-t-transparent animate-spin" />
          <span className="text-text-secondary text-sm">Loading game state...</span>
        </div>
      </div>
    );
  }

  if (error && !gameConfig) {
    return (
      <div className="card-glass p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-red-400 mb-2 text-sm">{error}</p>
        <p className="text-text-dim text-xs mb-4">
          The game may not be initialized yet. An admin needs to run{" "}
          <code className="bg-bg-elevated px-1.5 py-0.5 rounded text-accent-violet">
            initialize_game
          </code>{" "}
          first.
        </p>
        <button
          onClick={refreshState}
          className="px-4 py-2 bg-accent-purple/10 border border-accent-purple/20 rounded-xl text-sm text-accent-violet hover:bg-accent-purple/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const activeRounds = rounds.filter((r) => r.account.isActive);
  const completedRounds = rounds.filter((r) => !r.account.isActive);

  return (
    <div className="space-y-6">
      {/* Game Info Header */}
      {gameConfig && (
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-text-primary">
              Game Dashboard
            </h2>
            <button
              onClick={refreshState}
              disabled={txPending}
              className="text-xs text-text-dim hover:text-accent-cyan bg-bg-elevated px-3 py-1.5 rounded-lg border border-border hover:border-border-light transition-all disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg-elevated rounded-xl p-4 text-center border border-border">
              <p className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Entry Fee</p>
              <p className="text-xl font-bold text-accent-green font-mono">
                {(gameConfig.entryFeeLamports / LAMPORTS_PER_SOL).toFixed(3)}
              </p>
              <p className="text-[11px] text-text-dim">SOL</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-4 text-center border border-border">
              <p className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Rounds</p>
              <p className="text-xl font-bold text-text-primary font-mono">{gameConfig.roundCount}</p>
              <p className="text-[11px] text-text-dim">Total</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-4 text-center border border-border">
              <p className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Fee</p>
              <p className="text-xl font-bold text-accent-amber font-mono">
                {(gameConfig.feeBasisPoints / 100).toFixed(1)}%
              </p>
              <p className="text-[11px] text-text-dim">Platform</p>
            </div>
          </div>
        </div>
      )}

      {/* Active Rounds */}
      {activeRounds.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            Active Rounds
          </h3>
          {activeRounds.map((round) => (
            <ActiveRound key={round.publicKey.toBase58()} round={round} refreshState={refreshState} />
          ))}
        </div>
      )}

      {/* No Active Rounds */}
      {activeRounds.length === 0 && gameConfig && (
        <div className="card-glass p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
            <svg className="w-6 h-6 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-text-secondary mb-1">No active rounds</p>
          <p className="text-text-dim text-sm">
            Waiting for admin to create a new round...
          </p>
        </div>
      )}

      {/* Completed Rounds */}
      {completedRounds.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-dim px-1">
            Completed Rounds
          </h3>
          {completedRounds.slice(0, 5).map((round) => (
            <RoundInfo
              key={round.publicKey.toBase58()}
              round={round}
              distributePot={distributePot}
              mintRewardNft={mintRewardNft}
              txPending={txPending}
            />
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
