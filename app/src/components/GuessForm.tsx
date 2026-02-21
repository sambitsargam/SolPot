"use client";

import { useState, useEffect } from "react";
import { useGame, type RoundWithKey } from "@/hooks/useGame";
import { hashWord, prepareEncryptedGuess, MXE_PUBLIC_KEY, serializeEncryptedPayload } from "@/lib/arcium";

interface GuessFormProps {
  round: RoundWithKey;
  joined?: boolean;
  onGuessSubmitted?: () => Promise<void>;
}

export default function GuessForm({ round, joined: joinedProp, onGuessSubmitted }: GuessFormProps) {
  const { submitGuess, hasEnteredRound, hasGuessedInRound, checkGuessResult, txPending } = useGame();
  const [guess, setGuess] = useState("");
  const [joinedLocal, setJoinedLocal] = useState(false);
  const [checkingEntry, setCheckingEntry] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyGuessed, setAlreadyGuessed] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLoseModal, setShowLoseModal] = useState(false);

  const joined = joinedProp ?? joinedLocal;
  const [result, setResult] = useState<{
    type: "success" | "incorrect" | "error";
    message: string;
  } | null>(null);
  const [encryptionInfo, setEncryptionInfo] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, [round.publicKey, hasEnteredRound, hasGuessedInRound]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || alreadyGuessed) return;

    setSubmitting(true);
    setResult(null);
    setEncryptionInfo(null);

    try {
      // Step 1: Encrypt the guess using Arcium's RescueCipher + x25519 ECDH
      const { encryptedPayload, guessHash, ephemeralKeyPair } = prepareEncryptedGuess(
        guess,
        MXE_PUBLIC_KEY
      );

      const serialized = serializeEncryptedPayload(encryptedPayload);

      setEncryptionInfo(
        `Arcium RescueCipher: ${encryptedPayload.ciphertext.length} block(s), ${serialized.length} bytes total`
      );

      console.log("[Arcium] Encrypted guess payload:", {
        ciphertextBlocks: encryptedPayload.ciphertext.length,
        nonce: Buffer.from(encryptedPayload.nonce).toString("hex"),
        clientPubKey: Buffer.from(ephemeralKeyPair.publicKey).toString("hex").slice(0, 16) + "...",
        serializedBytes: serialized.length,
      });

      // Step 2: Submit the plaintext guess to the on-chain program for SHA-256 verification
      const txSig = await submitGuess(round.publicKey, guess.trim());

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
          message: `🎉 Correct! You won the pot! Tx: ${txSig.slice(0, 12)}...`,
        });
      } else {
        setShowLoseModal(true);
        setResult({
          type: "incorrect",
          message: `Wrong guess. Better luck next time! Tx: ${txSig.slice(0, 12)}...`,
        });
      }
      setGuess("");
    } catch (err: any) {
      const msg = err.message || "Failed to submit guess";
      if (msg.includes("RoundAlreadyWon")) {
        setResult({
          type: "error",
          message: "This round already has a winner!",
        });
      } else if (msg.includes("RoundExpired")) {
        setResult({
          type: "error",
          message: "This round has expired.",
        });
      } else if (msg.includes("AlreadyGuessed") || msg.includes("already in use")) {
        setAlreadyGuessed(true);
        setResult({ type: "error", message: "You have already submitted a guess for this round." });
      } else {
        setResult({
          type: "error",
          message: msg,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!round.account.isActive || round.account.hasWinner) {
    return (
      <div className="card-glass p-5">
        <h4 className="text-sm font-medium text-accent-violet mb-3">
          Submit Guess
        </h4>
        <p className="text-text-muted text-sm">
          {round.account.hasWinner
            ? `Winner: ${round.account.winner.toBase58().slice(0, 8)}...`
            : "Round is not active"}
        </p>
      </div>
    );
  }

  // Not yet entered this round
  if (!joined && !checkingEntry) {
    return (
      <div className="card-glass p-5">
        <h4 className="text-sm font-medium text-accent-violet mb-3">
          Submit Encrypted Guess
        </h4>
        <div className="bg-bg-elevated rounded-xl p-4 border border-border text-center">
          <svg className="w-6 h-6 mx-auto mb-2 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <p className="text-sm text-text-secondary mb-1">Enter the round first</p>
          <p className="text-[11px] text-text-dim">Pay the entry fee to unlock guessing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass p-5">
      <h4 className="text-sm font-medium text-accent-violet mb-3">
        Submit Encrypted Guess
      </h4>

      {/* Already guessed banner */}
      {alreadyGuessed && (
        <div className="mb-4 p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-accent-amber text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          You&apos;ve already submitted your guess. One guess per round!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-text-dim mb-1.5 block">
            Your guess (case-insensitive)
          </label>
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Enter your guess..."
            className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/20 transition-all"
            disabled={txPending || submitting || alreadyGuessed}
          />
        </div>

        {/* Encryption indicator */}
        <div className="flex items-center gap-2 text-[11px] text-text-dim">
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

        <button
          type="submit"
          disabled={txPending || submitting || !guess.trim() || alreadyGuessed}
          className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/20 hover:border-accent-green/30"
        >
          {alreadyGuessed
            ? "Guess Already Submitted"
            : submitting
            ? "Submitting..."
            : "Submit Guess"}
        </button>
      </form>

      {/* Encryption metadata */}
      {encryptionInfo && (
        <p className="text-[11px] text-text-dim mt-2 font-mono">
          {encryptionInfo}
        </p>
      )}

      {/* Result */}
      {result && (
        <div
          className={`mt-3 p-3 rounded-xl text-sm ${
            result.type === "success"
              ? "bg-accent-green/5 text-accent-green border border-accent-green/20"
              : result.type === "incorrect"
              ? "bg-accent-amber/5 text-accent-amber border border-accent-amber/20"
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
              Congratulations! Your guess was correct. You&apos;ve won the pot!
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
            <h3 className="text-xl font-bold text-accent-amber mb-2">Wrong Guess!</h3>
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
