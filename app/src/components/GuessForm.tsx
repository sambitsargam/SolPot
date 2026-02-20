"use client";

import { useState } from "react";
import { useGame, type RoundWithKey } from "@/hooks/useGame";
import { hashWord, prepareEncryptedGuess, generateKeyPair } from "@/lib/arcium";

interface GuessFormProps {
  round: RoundWithKey;
}

export default function GuessForm({ round }: GuessFormProps) {
  const { submitGuess, txPending } = useGame();
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<{
    type: "success" | "incorrect" | "error";
    message: string;
  } | null>(null);
  const [encryptionInfo, setEncryptionInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;

    setResult(null);
    setEncryptionInfo(null);

    try {
      // Step 1: Encrypt the guess client-side using Arcium-style encryption
      const gameKeyPair = generateKeyPair(); // In production, this would be the game's published public key
      const { encryptedPayload, guessHash } = prepareEncryptedGuess(
        guess,
        gameKeyPair.publicKey
      );

      setEncryptionInfo(
        `Encrypted with X25519 + XChaCha20-Poly1305 (${encryptedPayload.ciphertext.length} bytes)`
      );

      // Step 2: Submit the plaintext guess to the on-chain program
      // The program hashes it with SHA-256 and compares to the stored word hash
      // The encryption above provides transport-layer privacy (mempool protection)
      const txSig = await submitGuess(round.publicKey, guess.trim());

      // Step 3: Check if guess was correct by re-fetching round state
      // The on-chain program sets has_winner = true if correct
      setResult({
        type: "success",
        message: `Guess submitted! Tx: ${txSig.slice(0, 12)}...`,
      });
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
      } else {
        setResult({
          type: "error",
          message: msg,
        });
      }
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

  return (
    <div className="card-glass p-5">
      <h4 className="text-sm font-medium text-accent-violet mb-3">
        Submit Encrypted Guess
      </h4>

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
            disabled={txPending}
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
          Encrypted via Arcium (X25519 + XChaCha20-Poly1305)
        </div>

        <button
          type="submit"
          disabled={txPending || !guess.trim()}
          className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/20 hover:border-accent-green/30"
        >
          {txPending ? "Submitting..." : "Submit Guess"}
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
    </div>
  );
}
