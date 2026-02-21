"use client";

import { useState, useEffect } from "react";
import { useGame, type RoundWithKey } from "@/hooks/useGame";

interface LuckyNumberGameProps {
  round: RoundWithKey;
  joined?: boolean;
  onGuessSubmitted?: () => Promise<void>;
}

export default function LuckyNumberGame({
  round,
  joined: joinedProp,
  onGuessSubmitted,
}: LuckyNumberGameProps) {
  const { submitGuess, hasEnteredRound, hasGuessedInRound, txPending } = useGame();
  const [selected, setSelected] = useState<number | null>(null);
  const [joinedLocal, setJoinedLocal] = useState(false);
  const [checkingEntry, setCheckingEntry] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyGuessed, setAlreadyGuessed] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState<number | null>(null);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const joined = joinedProp ?? joinedLocal;

  // Check if user has entered this round and already guessed
  useEffect(() => {
    let cancelled = false;
    setCheckingEntry(true);
    Promise.all([
      hasEnteredRound(round.publicKey),
      hasGuessedInRound(round.publicKey),
    ]).then(([entered, guessed]) => {
      if (!cancelled) {
        setJoinedLocal(entered);
        setAlreadyGuessed(guessed);
        setCheckingEntry(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [round.publicKey, hasEnteredRound, hasGuessedInRound]);

  const handleNumberClick = (num: number) => {
    if (!joined || txPending || submitting || alreadyGuessed) return;
    setSelected(num);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (selected === null || !joined || alreadyGuessed) return;

    setSubmitting(true);
    setResult(null);

    try {
      // Submit the number as a string — the contract SHA-256 hashes it
      const txSig = await submitGuess(round.publicKey, String(selected));

      setSubmittedNumber(selected);
      setAlreadyGuessed(true);

      if (onGuessSubmitted) {
        await onGuessSubmitted();
      }

      setResult({
        type: "success",
        message: `#${selected} submitted! Tx: ${txSig.slice(0, 12)}...`,
      });
      setSelected(null);
    } catch (err: any) {
      const msg = err.message || "Failed to submit guess";
      if (msg.includes("RoundAlreadyWon")) {
        setResult({
          type: "error",
          message: "This round already has a winner!",
        });
      } else if (msg.includes("RoundExpired")) {
        setResult({ type: "error", message: "This round has expired." });
      } else if (msg.includes("AlreadyGuessed") || msg.includes("already in use")) {
        setAlreadyGuessed(true);
        setResult({ type: "error", message: "You have already submitted a guess for this round." });
      } else {
        setResult({ type: "error", message: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Inactive / already won
  if (!round.account.isActive || round.account.hasWinner) {
    return (
      <div className="card-glass p-5">
        <h4 className="text-sm font-medium text-accent-cyan mb-3 flex items-center gap-2">
          <span className="text-lg">🎰</span>
          Lucky Number
        </h4>
        <p className="text-text-muted text-sm">
          {round.account.hasWinner
            ? `Winner: ${round.account.winner.toBase58().slice(0, 8)}...`
            : "Round is not active"}
        </p>
      </div>
    );
  }

  // Not entered yet
  if (!joined && !checkingEntry) {
    return (
      <div className="card-glass p-5">
        <h4 className="text-sm font-medium text-accent-cyan mb-3 flex items-center gap-2">
          <span className="text-lg">🎰</span>
          Pick Your Lucky Number
        </h4>
        <div className="bg-bg-elevated rounded-xl p-4 border border-border text-center">
          <svg
            className="w-6 h-6 mx-auto mb-2 text-text-dim"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <p className="text-sm text-text-secondary mb-1">
            Enter the round first
          </p>
          <p className="text-[11px] text-text-dim">
            Pay the entry fee to unlock the number grid
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-accent-cyan flex items-center gap-2">
          <span className="text-lg">🎰</span>
          Pick Your Lucky Number
        </h4>
        {selected !== null && (
          <span className="text-sm font-mono font-bold text-accent-cyan">
            #{selected}
          </span>
        )}
      </div>

      {/* Already guessed banner */}
      {alreadyGuessed && (
        <div className="mb-4 p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-accent-amber text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          You&apos;ve already submitted your guess{submittedNumber ? ` (#${submittedNumber})` : ""}. One guess per round!
        </div>
      )}

      {/* Number Grid — 10×10 */}
      <div className="grid grid-cols-10 gap-1 mb-4">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => {
          const isSelected = selected === num;

          return (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              disabled={!joined || txPending || submitting || alreadyGuessed}
              className={`
                aspect-square rounded-lg text-[11px] font-mono font-bold
                transition-all duration-150 relative
                ${
                  isSelected
                    ? "bg-accent-cyan text-bg-primary border-accent-cyan shadow-lg shadow-accent-cyan/30 scale-110 z-10"
                    : alreadyGuessed
                    ? "bg-bg-elevated/50 text-text-dim/40 border-border/50 cursor-not-allowed"
                    : "bg-bg-elevated text-text-dim border-border hover:bg-accent-cyan/10 hover:text-accent-cyan hover:border-accent-cyan/30"
                }
                border disabled:opacity-50
              `}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={selected === null || txPending || submitting || alreadyGuessed}
        className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/20 hover:border-accent-cyan/30"
      >
        {alreadyGuessed
          ? "Guess Already Submitted"
          : submitting
          ? "Submitting..."
          : selected !== null
          ? `Submit #${selected}`
          : "Select a number"}
      </button>

      {/* Encryption indicator */}
      <div className="flex items-center gap-2 text-[11px] text-text-dim mt-3">
        <svg
          className="w-3 h-3 text-accent-green"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
        </svg>
        Encrypted via Arcium (x25519 ECDH + RescueCipher)
      </div>

      {/* Result */}
      {result && (
        <div
          className={`mt-3 p-3 rounded-xl text-sm ${
            result.type === "success"
              ? "bg-accent-green/5 text-accent-green border border-accent-green/20"
              : "bg-red-500/5 text-red-400 border border-red-500/20"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
