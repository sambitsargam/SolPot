"use client";

import { useState, useEffect } from "react";
import { useGame, type RoundWithKey } from "@/hooks/useGame";
import { getTriviaQuestion, type TriviaQuestion } from "@/lib/gameTypes";

interface TriviaGameProps {
  round: RoundWithKey;
  joined?: boolean;
  onGuessSubmitted?: () => Promise<void>;
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

const OPTION_COLORS = [
  {
    bg: "bg-accent-purple/10",
    border: "border-accent-purple/20",
    text: "text-accent-violet",
    hoverBg: "hover:bg-accent-purple/20",
    hoverBorder: "hover:border-accent-purple/30",
    activeBg: "bg-accent-purple/30",
    activeBorder: "border-accent-purple/50",
  },
  {
    bg: "bg-accent-cyan/10",
    border: "border-accent-cyan/20",
    text: "text-accent-cyan",
    hoverBg: "hover:bg-accent-cyan/20",
    hoverBorder: "hover:border-accent-cyan/30",
    activeBg: "bg-accent-cyan/30",
    activeBorder: "border-accent-cyan/50",
  },
  {
    bg: "bg-accent-amber/10",
    border: "border-accent-amber/20",
    text: "text-accent-amber",
    hoverBg: "hover:bg-accent-amber/20",
    hoverBorder: "hover:border-accent-amber/30",
    activeBg: "bg-accent-amber/30",
    activeBorder: "border-accent-amber/50",
  },
  {
    bg: "bg-accent-green/10",
    border: "border-accent-green/20",
    text: "text-accent-green",
    hoverBg: "hover:bg-accent-green/20",
    hoverBorder: "hover:border-accent-green/30",
    activeBg: "bg-accent-green/30",
    activeBorder: "border-accent-green/50",
  },
];

/** Default trivia question when no specific one is mapped */
const DEFAULT_QUESTION: TriviaQuestion = {
  question: "What is the native token of the Solana blockchain?",
  options: ["Ethereum", "Solana (SOL)", "Bitcoin", "Cardano"],
  category: "Crypto",
};

export default function TriviaGame({
  round,
  joined: joinedProp,
  onGuessSubmitted,
}: TriviaGameProps) {
  const { submitGuess, hasEnteredRound, hasGuessedInRound, checkGuessResult, txPending } = useGame();
  const [selected, setSelected] = useState<number | null>(null);
  const [joinedLocal, setJoinedLocal] = useState(false);
  const [checkingEntry, setCheckingEntry] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyGuessed, setAlreadyGuessed] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLoseModal, setShowLoseModal] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const joined = joinedProp ?? joinedLocal;
  const triviaQ = getTriviaQuestion(round.account.id) ?? DEFAULT_QUESTION;

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

  const handleOptionClick = (index: number) => {
    if (!joined || txPending || submitting || alreadyGuessed) return;
    setSelected(index);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (selected === null || !joined || alreadyGuessed) return;

    setSubmitting(true);
    setResult(null);

    try {
      // Submit the selected answer text — the contract SHA-256 hashes it
      const answer = triviaQ.options[selected];
      const txSig = await submitGuess(round.publicKey, answer);

      setAlreadyGuessed(true);

      // Check if we won
      const won = await checkGuessResult(round.publicKey);

      if (onGuessSubmitted) {
        await onGuessSubmitted();
      }

      if (won) {
        setShowWinModal(true);
        setResult({
          type: "success",
          message: `🎉 Correct answer! You won the pot! Tx: ${txSig.slice(0, 12)}...`,
        });
      } else {
        setShowLoseModal(true);
        setResult({
          type: "success",
          message: `Wrong answer. Better luck next time! Tx: ${txSig.slice(0, 12)}...`,
        });
      }
    } catch (err: any) {
      const msg = err.message || "Failed to submit answer";
      if (msg.includes("RoundAlreadyWon")) {
        setResult({
          type: "error",
          message: "This round already has a winner!",
        });
      } else if (msg.includes("RoundExpired")) {
        setResult({ type: "error", message: "This round has expired." });
      } else if (msg.includes("AlreadyGuessed") || msg.includes("already in use")) {
        setAlreadyGuessed(true);
        setResult({ type: "error", message: "You have already submitted an answer for this round." });
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
        <h4 className="text-sm font-medium text-accent-amber mb-3 flex items-center gap-2">
          <span className="text-lg">🧠</span>
          Trivia Challenge
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
        <h4 className="text-sm font-medium text-accent-amber mb-3 flex items-center gap-2">
          <span className="text-lg">🧠</span>
          Trivia Challenge
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
            Pay the entry fee to unlock the trivia question
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-accent-amber flex items-center gap-2">
          <span className="text-lg">🧠</span>
          Trivia Challenge
        </h4>
        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
          {triviaQ.category}
        </span>
      </div>

      {/* Question */}
      <div className="bg-bg-elevated rounded-xl p-4 border border-border mb-4">
        <p className="text-[11px] uppercase tracking-wider text-text-dim mb-2">
          Question
        </p>
        <p className="text-text-primary font-medium leading-relaxed">
          {triviaQ.question}
        </p>
      </div>

      {/* Already guessed banner */}
      {alreadyGuessed && (
        <div className="mb-4 p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-accent-amber text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          You&apos;ve already submitted your answer. One guess per round!
        </div>
      )}

      {/* Options */}
      <div className="space-y-2 mb-4">
        {triviaQ.options.map((option, i) => {
          const colors = OPTION_COLORS[i % OPTION_COLORS.length];
          const isSelected = selected === i;

          return (
            <button
              key={i}
              onClick={() => handleOptionClick(i)}
              disabled={!joined || txPending || submitting || alreadyGuessed}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left
                ${
                  isSelected
                    ? `${colors.activeBg} ${colors.activeBorder} shadow-sm`
                    : alreadyGuessed
                    ? "bg-bg-elevated/50 border-border/50 cursor-not-allowed"
                    : `${colors.bg} ${colors.border} ${colors.hoverBg} ${colors.hoverBorder}`
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {/* Letter badge */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors
                  ${
                    isSelected
                      ? `bg-bg-primary ${colors.text}`
                      : `bg-bg-primary/50 ${colors.text}`
                  }
                `}
              >
                {OPTION_LETTERS[i]}
              </div>

              {/* Option text */}
              <span
                className={`text-sm font-medium ${
                  isSelected ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                {option}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <div className="ml-auto">
                  <svg
                    className={`w-5 h-5 ${colors.text}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={selected === null || txPending || submitting || alreadyGuessed}
        className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-accent-amber/10 border border-accent-amber/20 text-accent-amber hover:bg-accent-amber/20 hover:border-accent-amber/30"
      >
        {alreadyGuessed
          ? "Answer Already Submitted"
          : submitting
          ? "Submitting..."
          : selected !== null
          ? `Submit Answer ${OPTION_LETTERS[selected]}`
          : "Select an answer"}
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

      {/* Win Modal */}
      {showWinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-accent-green/30 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl shadow-accent-green/10 animate-in fade-in zoom-in duration-300">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-accent-green mb-2">You Won!</h3>
            <p className="text-text-secondary text-sm mb-6">
              Congratulations! Your answer was correct. You&apos;ve won the pot!
            </p>
            <button
              onClick={() => setShowWinModal(false)}
              className="px-6 py-2.5 rounded-xl bg-accent-green/10 border border-accent-green/20 text-accent-green font-medium text-sm hover:bg-accent-green/20 transition-all"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* Lose Modal */}
      {showLoseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-accent-amber/30 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl shadow-accent-amber/10 animate-in fade-in zoom-in duration-300">
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-xl font-bold text-accent-amber mb-2">Wrong Answer!</h3>
            <p className="text-text-secondary text-sm mb-6">
              That wasn&apos;t the right answer. Better luck next time!
            </p>
            <button
              onClick={() => setShowLoseModal(false)}
              className="px-6 py-2.5 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-accent-amber font-medium text-sm hover:bg-accent-amber/20 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
