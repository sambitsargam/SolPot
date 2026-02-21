"use client";

import { useState, useCallback } from "react";
import { useGame, type RoundWithKey } from "@/hooks/useGame";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import RoundInfo from "./RoundInfo";
import GuessForm from "./GuessForm";
import JupiterSwap from "./JupiterSwap";

/* ─── Tabs ──────────────────────────────────────────────────────── */

type Tab = "arena" | "history";

const TABS: { key: Tab; label: string; icon: JSX.Element }[] = [
  {
    key: "arena",
    label: "Arena",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    key: "history",
    label: "History",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/* ─── Active Round Wrapper ──────────────────────────────────────── */

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

/* ─── Main GameBoard ────────────────────────────────────────────── */

export default function GameBoard() {
  const { gameConfig, rounds, loading, error, txPending, refreshState, distributePot, mintRewardNft } =
    useGame();
  const [activeTab, setActiveTab] = useState<Tab>("arena");

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

  const now = Math.floor(Date.now() / 1000);
  const activeRounds = rounds.filter((r) => r.account.isActive && r.account.expiresAt > now);
  const completedRounds = rounds.filter((r) => !r.account.isActive || r.account.expiresAt <= now);
  const totalPot = activeRounds.reduce((sum, r) => sum + r.account.potLamports, 0);
  const totalPlayers = activeRounds.reduce((sum, r) => sum + r.account.playerCount, 0);
  const totalWinners = completedRounds.filter((r) => {
    try {
      return r.account.hasWinner && r.account.winner.toBase58() !== PublicKey.default.toBase58();
    } catch { return false; }
  }).length;

  return (
    <div className="space-y-5">
      {/* ── Enhanced Dashboard Header ── */}
      {gameConfig && (
        <div className="card-glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              Game Dashboard
            </h2>
            <button
              onClick={refreshState}
              disabled={txPending}
              className="text-[11px] text-text-dim hover:text-accent-cyan bg-bg-elevated px-3 py-1.5 rounded-lg border border-border hover:border-border-light transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <div className="bg-bg-elevated rounded-xl p-3 border border-border group hover:border-accent-green/30 transition-colors">
              <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">Total Pot</p>
              <p className="text-lg font-bold text-accent-green font-mono">
                {(totalPot / LAMPORTS_PER_SOL).toFixed(3)}
              </p>
              <p className="text-[10px] text-text-dim">SOL locked</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-3 border border-border group hover:border-accent-cyan/30 transition-colors">
              <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">Active</p>
              <p className="text-lg font-bold text-accent-cyan font-mono">
                {activeRounds.length}
              </p>
              <p className="text-[10px] text-text-dim">Rounds live</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-3 border border-border group hover:border-accent-purple/30 transition-colors">
              <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">Players</p>
              <p className="text-lg font-bold text-accent-violet font-mono">
                {totalPlayers}
              </p>
              <p className="text-[10px] text-text-dim">Competing</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-3 border border-border group hover:border-accent-amber/30 transition-colors">
              <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">Entry Fee</p>
              <p className="text-lg font-bold text-accent-amber font-mono">
                {(gameConfig.entryFeeLamports / LAMPORTS_PER_SOL).toFixed(3)}
              </p>
              <p className="text-[10px] text-text-dim">SOL per round</p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-3 border border-border group hover:border-accent-green/30 transition-colors">
              <p className="text-[10px] uppercase tracking-wider text-text-dim mb-0.5">Winners</p>
              <p className="text-lg font-bold text-text-primary font-mono">
                {totalWinners}
              </p>
              <p className="text-[10px] text-text-dim">
                of {gameConfig.roundCount} rounds
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 bg-bg-elevated/50 rounded-xl p-1 border border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-bg-primary text-text-primary shadow-sm border border-border"
                : "text-text-dim hover:text-text-secondary"
            }`}
          >
            <span className={activeTab === tab.key ? "text-accent-purple" : ""}>{tab.icon}</span>
            {tab.label}
            {tab.key === "arena" && activeRounds.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-accent-green/10 text-accent-green text-[11px] flex items-center justify-center font-mono border border-accent-green/20">
                {activeRounds.length}
              </span>
            )}
            {tab.key === "history" && completedRounds.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-bg-elevated text-text-dim text-[11px] flex items-center justify-center font-mono border border-border">
                {completedRounds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}

      {/* Arena Tab */}
      {activeTab === "arena" && (
        <div className="space-y-4">
          {activeRounds.length > 0 ? (
            activeRounds.map((round) => (
              <ActiveRound
                key={round.publicKey.toBase58()}
                round={round}
                refreshState={refreshState}
              />
            ))
          ) : (
            <div className="card-glass p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                <svg className="w-7 h-7 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-text-secondary mb-1 font-medium">No active rounds</p>
              <p className="text-text-dim text-sm">
                Waiting for admin to create a new round...
              </p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {completedRounds.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium text-text-secondary">
                  {completedRounds.length} completed round{completedRounds.length !== 1 ? "s" : ""}
                </h3>
              </div>
              {completedRounds.map((round) => (
                <RoundInfo
                  key={round.publicKey.toBase58()}
                  round={round}
                  distributePot={distributePot}
                  mintRewardNft={mintRewardNft}
                  txPending={txPending}
                />
              ))}
            </>
          ) : (
            <div className="card-glass p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                <svg className="w-7 h-7 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <p className="text-text-secondary mb-1 font-medium">No history yet</p>
              <p className="text-text-dim text-sm">
                Completed rounds will appear here.
              </p>
            </div>
          )}
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
