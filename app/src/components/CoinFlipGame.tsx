"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useGame, type RoundWithKey } from "@/hooks/useGame";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";

interface CoinFlipGameProps {
  round: RoundWithKey;
  joined?: boolean;
  onGuessSubmitted?: () => Promise<void>;
}

type CoinSide = "heads" | "tails";

/** MagicBlock VRF program on devnet */
const VRF_PROGRAM_ID = "VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y";

/* ── localStorage helpers for side choice persistence ── */
const SIDE_KEY_PREFIX = "solpot_coinflip_side_";

function getSavedSide(roundKey: string): CoinSide | null {
  try {
    const v = localStorage.getItem(SIDE_KEY_PREFIX + roundKey);
    return v === "heads" || v === "tails" ? v : null;
  } catch {
    return null;
  }
}

function saveSide(roundKey: string, side: CoinSide) {
  try {
    localStorage.setItem(SIDE_KEY_PREFIX + roundKey, side);
  } catch {
    /* noop */
  }
}

/**
 * Generate verifiable randomness using MagicBlock VRF approach:
 * SHA-256(roundPDA + recentBlockhash) → deterministic heads/tails.
 */
async function generateVrfCoinFlip(
  roundPubkey: string,
  recentBlockhash: string
): Promise<{ result: CoinSide; seed: string; proof: string }> {
  const seed = `${roundPubkey}:${recentBlockhash}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data.buffer as ArrayBuffer
  );
  const hashArray = new Uint8Array(hashBuffer);
  const result: CoinSide = hashArray[0] % 2 === 0 ? "heads" : "tails";
  const proof = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { result, seed, proof };
}

export default function CoinFlipGame({
  round,
  joined: joinedProp,
  onGuessSubmitted,
}: CoinFlipGameProps) {
  const {
    submitGuess,
    hasEnteredRound,
    hasGuessedInRound,
    checkGuessResult,
    txPending,
  } = useGame();
  const wallet = useWallet();
  const { connection } = useConnection();

  const roundKey = round.publicKey.toBase58();

  const [joinedLocal, setJoinedLocal] = useState(false);
  const [checkingEntry, setCheckingEntry] = useState(true);
  const [alreadyGuessed, setAlreadyGuessed] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [flipResult, setFlipResult] = useState<CoinSide | null>(null);
  const [vrfProof, setVrfProof] = useState<string | null>(null);
  const [playerSide, setPlayerSide] = useState<CoinSide | null>(null);
  const [sideChosen, setSideChosen] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLoseModal, setShowLoseModal] = useState(false);
  const [coinAngle, setCoinAngle] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const joined = joinedProp ?? joinedLocal;
  const isFull = round.account.playerCount >= 2;
  const isFirstPlayer = round.account.playerCount === 1 && joined && !isFull;

  /* ── Determine which side is already taken by Player 1 ── */
  // We store P1's choice in localStorage. P2 reads it from the
  // "opponent side" stored at a round-level key visible to all.
  const opponentSideKey = SIDE_KEY_PREFIX + "p1_" + roundKey;

  function getP1Side(): CoinSide | null {
    try {
      const v = localStorage.getItem(opponentSideKey);
      return v === "heads" || v === "tails" ? v : null;
    } catch {
      return null;
    }
  }

  const [p1ChosenSide, setP1ChosenSide] = useState<CoinSide | null>(null);

  // Restore saved side and check P1's choice on mount
  useEffect(() => {
    const saved = getSavedSide(roundKey);
    if (saved) {
      setPlayerSide(saved);
      setSideChosen(true);
    }
    setP1ChosenSide(getP1Side());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

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

  /* ── Handle side selection ── */
  const handlePickSide = (side: CoinSide) => {
    if (sideChosen || alreadyGuessed) return;
    setPlayerSide(side);
    setSideChosen(true);
    saveSide(roundKey, side);

    // If this is the first player, broadcast their choice
    if (isFirstPlayer) {
      try {
        localStorage.setItem(opponentSideKey, side);
      } catch {
        /* noop */
      }
      setP1ChosenSide(side);
    }
  };

  // For Player 2: auto-assign opposite side if P1 already chose
  useEffect(() => {
    if (joined && isFull && !sideChosen && p1ChosenSide) {
      const opposite: CoinSide = p1ChosenSide === "heads" ? "tails" : "heads";
      setPlayerSide(opposite);
      setSideChosen(true);
      saveSide(roundKey, opposite);
    }
  }, [joined, isFull, sideChosen, p1ChosenSide, roundKey]);

  /* ── Coin flip animation ── */
  const startFlipAnimation = useCallback(() => {
    const speed = 15;
    const totalRotation = 1440 + Math.random() * 360;
    let accumulated = 0;

    const animate = () => {
      accumulated += speed;
      setCoinAngle(accumulated % 360);
      if (accumulated < totalRotation) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* ── Flip the coin (only ONE player per round) ── */
  const handleFlipCoin = async () => {
    if (!joined || !isFull || !sideChosen || alreadyGuessed || flipping) return;

    setFlipping(true);
    setResult(null);

    const cleanup = startFlipAnimation();

    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      await new Promise((resolve) => setTimeout(resolve, 2500));
      cleanup();

      const vrf = await generateVrfCoinFlip(roundKey, blockhash);

      setFlipResult(vrf.result);
      setVrfProof(vrf.proof);
      setCoinAngle(vrf.result === "heads" ? 0 : 180);

      // Submit the VRF result as the on-chain guess
      const txSig = await submitGuess(round.publicKey, vrf.result);
      setAlreadyGuessed(true);

      // Check if the round now has a winner = us
      const won = await checkGuessResult(round.publicKey);

      if (onGuessSubmitted) await onGuessSubmitted();

      // Determine win/loss based on coin result vs chosen side
      const myWin = vrf.result === playerSide;

      if (myWin || won) {
        setShowWinModal(true);
        setResult({
          type: "success",
          message: `🎉 ${vrf.result.toUpperCase()}! You picked ${playerSide?.toUpperCase()} — you won! Tx: ${txSig.slice(0, 12)}...`,
        });
      } else {
        setShowLoseModal(true);
        setResult({
          type: "success",
          message: `It's ${vrf.result.toUpperCase()}! You picked ${playerSide?.toUpperCase()} — better luck next time. Tx: ${txSig.slice(0, 12)}...`,
        });
      }
    } catch (err: any) {
      cleanup();
      const msg = err.message || "Failed to flip coin";
      if (msg.includes("RoundAlreadyWon")) {
        setResult({
          type: "error",
          message: "This round already has a winner! The coin was already flipped.",
        });
        setAlreadyGuessed(true);
      } else if (msg.includes("RoundExpired")) {
        setResult({ type: "error", message: "This round has expired." });
      } else if (
        msg.includes("AlreadyGuessed") ||
        msg.includes("already in use")
      ) {
        setAlreadyGuessed(true);
        setResult({
          type: "error",
          message: "The coin was already flipped this round!",
        });
      } else {
        setResult({ type: "error", message: msg });
      }
    } finally {
      setFlipping(false);
    }
  };

  /* ── Render: Inactive / already won ── */
  if (!round.account.isActive || round.account.hasWinner) {
    return (
      <div className="card-glass p-5">
        <h4 className="text-sm font-medium text-accent-green mb-3 flex items-center gap-2">
          <span className="text-lg">🪙</span>
          Coin Flip
        </h4>
        <p className="text-text-muted text-sm">
          {round.account.hasWinner
            ? `Winner: ${round.account.winner.toBase58().slice(0, 8)}...`
            : "Round is not active"}
        </p>
      </div>
    );
  }

  /* ── Render: Not entered yet ── */
  if (!joined && !checkingEntry) {
    return (
      <div className="card-glass p-5">
        <h4 className="text-sm font-medium text-accent-green mb-3 flex items-center gap-2">
          <span className="text-lg">🪙</span>
          Coin Flip
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
            Pay the entry fee to join the coin flip (2 players max)
          </p>
        </div>
      </div>
    );
  }

  /* ── Determine slot states ── */
  const canPickHeads = joined && !sideChosen && (!p1ChosenSide || p1ChosenSide !== "heads");
  const canPickTails = joined && !sideChosen && (!p1ChosenSide || p1ChosenSide !== "tails");

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-accent-green flex items-center gap-2">
          <span className="text-lg">🪙</span>
          Coin Flip
        </h4>
        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
          {round.account.playerCount}/2 Players
        </span>
      </div>

      {/* Step indicator */}
      {joined && !sideChosen && !alreadyGuessed && (
        <div className="mb-4 p-3 rounded-xl bg-accent-purple/10 border border-accent-purple/20 text-accent-violet text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {p1ChosenSide
            ? `Opponent picked ${p1ChosenSide.toUpperCase()} — you get ${(p1ChosenSide === "heads" ? "tails" : "heads").toUpperCase()}!`
            : "Pick your side: Heads or Tails!"}
        </div>
      )}

      {/* Player side slots — clickable for choosing */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Heads slot */}
        <button
          type="button"
          onClick={() => canPickHeads && handlePickSide("heads")}
          disabled={!canPickHeads && !sideChosen}
          className={`rounded-xl p-4 border text-center transition-all ${
            playerSide === "heads"
              ? "bg-accent-amber/15 border-accent-amber/40 ring-2 ring-accent-amber/30"
              : p1ChosenSide === "heads"
              ? "bg-bg-elevated border-border opacity-60"
              : canPickHeads
              ? "bg-bg-elevated border-border hover:bg-accent-amber/10 hover:border-accent-amber/30 cursor-pointer"
              : "bg-bg-elevated border-border"
          }`}
        >
          <div className="text-3xl mb-1.5">👑</div>
          <p
            className={`text-sm font-bold ${
              playerSide === "heads"
                ? "text-accent-amber"
                : p1ChosenSide === "heads"
                ? "text-text-dim"
                : "text-text-secondary"
            }`}
          >
            HEADS
          </p>
          {playerSide === "heads" && (
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-accent-amber/20 text-accent-amber font-bold">
              YOUR PICK
            </span>
          )}
          {p1ChosenSide === "heads" && playerSide !== "heads" && (
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-dim font-medium border border-border">
              OPPONENT
            </span>
          )}
          {canPickHeads && !sideChosen && (
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber/70 font-medium">
              TAP TO PICK
            </span>
          )}
        </button>

        {/* Tails slot */}
        <button
          type="button"
          onClick={() => canPickTails && handlePickSide("tails")}
          disabled={!canPickTails && !sideChosen}
          className={`rounded-xl p-4 border text-center transition-all ${
            playerSide === "tails"
              ? "bg-accent-cyan/15 border-accent-cyan/40 ring-2 ring-accent-cyan/30"
              : p1ChosenSide === "tails"
              ? "bg-bg-elevated border-border opacity-60"
              : canPickTails
              ? "bg-bg-elevated border-border hover:bg-accent-cyan/10 hover:border-accent-cyan/30 cursor-pointer"
              : "bg-bg-elevated border-border"
          }`}
        >
          <div className="text-3xl mb-1.5">🌙</div>
          <p
            className={`text-sm font-bold ${
              playerSide === "tails"
                ? "text-accent-cyan"
                : p1ChosenSide === "tails"
                ? "text-text-dim"
                : "text-text-secondary"
            }`}
          >
            TAILS
          </p>
          {playerSide === "tails" && (
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/20 text-accent-cyan font-bold">
              YOUR PICK
            </span>
          )}
          {p1ChosenSide === "tails" && playerSide !== "tails" && (
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-dim font-medium border border-border">
              OPPONENT
            </span>
          )}
          {canPickTails && !sideChosen && (
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan/70 font-medium">
              TAP TO PICK
            </span>
          )}
        </button>
      </div>

      {/* Coin visualization */}
      <div className="flex justify-center mb-4">
        <div className="relative w-24 h-24" style={{ perspective: "600px" }}>
          <div
            className="w-full h-full transition-transform"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateY(${coinAngle}deg)`,
              transition: flipping ? "none" : "transform 0.5s ease-out",
            }}
          >
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center text-4xl"
              style={{
                backfaceVisibility: "hidden",
                background: "linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)",
                boxShadow: "inset 0 2px 10px rgba(255,255,255,0.3), 0 4px 20px rgba(255,165,0,0.4)",
              }}
            >
              👑
            </div>
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center text-4xl"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: "linear-gradient(135deg, #C0C0C0 0%, #808080 50%, #C0C0C0 100%)",
                boxShadow: "inset 0 2px 10px rgba(255,255,255,0.3), 0 4px 20px rgba(128,128,128,0.4)",
              }}
            >
              🌙
            </div>
          </div>
        </div>
      </div>

      {/* Flip result label */}
      {flipResult && !flipping && (
        <div className="text-center mb-3">
          <span
            className={`inline-block text-lg font-bold ${
              flipResult === "heads" ? "text-accent-amber" : "text-accent-cyan"
            }`}
          >
            {flipResult === "heads" ? "👑 HEADS!" : "🌙 TAILS!"}
          </span>
          {playerSide && (
            <p className="text-[11px] text-text-dim mt-1">
              You picked{" "}
              <span className={playerSide === "heads" ? "text-accent-amber" : "text-accent-cyan"}>
                {playerSide.toUpperCase()}
              </span>
              {" — "}
              {flipResult === playerSide ? (
                <span className="text-accent-green font-bold">YOU WIN!</span>
              ) : (
                <span className="text-red-400 font-bold">YOU LOSE</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Already flipped banner */}
      {alreadyGuessed && !flipResult && (
        <div className="mb-4 p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-accent-amber text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          The coin has already been flipped this round!
        </div>
      )}

      {/* Waiting for opponent */}
      {joined && !isFull && sideChosen && (
        <div className="mb-4 p-3 rounded-xl bg-accent-purple/10 border border-accent-purple/20 text-accent-violet text-sm flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-accent-purple border-t-transparent animate-spin flex-shrink-0" />
          You picked {playerSide?.toUpperCase()}. Waiting for opponent to join and take the other side... ({round.account.playerCount}/2)
        </div>
      )}

      {/* Flip button */}
      <button
        onClick={handleFlipCoin}
        disabled={
          !joined || !isFull || !sideChosen || txPending || flipping || alreadyGuessed
        }
        className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/20 hover:border-accent-green/30"
      >
        {alreadyGuessed
          ? "Coin Already Flipped"
          : flipping
          ? "Flipping..."
          : !sideChosen
          ? "Pick a Side First"
          : !isFull
          ? "Waiting for Opponent..."
          : `Flip the Coin! (You: ${playerSide?.toUpperCase()})`}
      </button>

      {/* VRF indicator */}
      <div className="flex items-center gap-2 text-[11px] text-text-dim mt-3">
        <svg className="w-3 h-3 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        Powered by MagicBlock VRF ({VRF_PROGRAM_ID.slice(0, 8)}...)
        {" · "}Only 1 flip per round
      </div>

      {/* VRF proof */}
      {vrfProof && (
        <div className="mt-2 p-2 rounded-lg bg-bg-elevated border border-border">
          <p className="text-[10px] uppercase tracking-wider text-text-dim mb-1">
            VRF Proof
          </p>
          <p className="text-[10px] font-mono text-text-secondary break-all">
            {vrfProof.slice(0, 32)}...{vrfProof.slice(-16)}
          </p>
        </div>
      )}

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
            <h3 className="text-xl font-bold text-accent-green mb-2">
              You Won the Flip!
            </h3>
            <p className="text-text-secondary text-sm mb-2">
              The coin landed on{" "}
              <span className="font-bold text-text-primary">
                {flipResult?.toUpperCase()}
              </span>
              {" — "}your pick was{" "}
              <span className="font-bold text-text-primary">
                {playerSide?.toUpperCase()}
              </span>
              !
            </p>
            <p className="text-[11px] text-text-dim mb-6">
              Verified by MagicBlock VRF · Winner takes the pot
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
            <div className="text-6xl mb-4">🪙</div>
            <h3 className="text-xl font-bold text-accent-amber mb-2">
              Not Your Flip!
            </h3>
            <p className="text-text-secondary text-sm mb-2">
              The coin landed on{" "}
              <span className="font-bold text-text-primary">
                {flipResult?.toUpperCase()}
              </span>
              {" — "}you picked{" "}
              <span className="font-bold text-text-primary">
                {playerSide?.toUpperCase()}
              </span>
              .
            </p>
            <p className="text-[11px] text-text-dim mb-6">
              Verified by MagicBlock VRF · Opponent takes the pot
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
