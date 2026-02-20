"use client";

import { useState, useEffect } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useGame, type RoundWithKey } from "@/hooks/useGame";
import { TOKEN_LIST, WSOL_MINT, IS_DEVNET } from "@/lib/constants";
import type { TokenInfo } from "@/lib/types";

interface JupiterSwapProps {
  round: RoundWithKey;
}

export default function JupiterSwap({ round }: JupiterSwapProps) {
  const { enterRound, hasEnteredRound, txPending } = useGame();
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(TOKEN_LIST[0]);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [checkingEntry, setCheckingEntry] = useState(true);

  // Check if user already entered this round
  useEffect(() => {
    let cancelled = false;
    setCheckingEntry(true);
    hasEnteredRound(round.publicKey).then((entered) => {
      if (!cancelled) {
        setJoined(entered);
        setCheckingEntry(false);
      }
    });
    return () => { cancelled = true; };
  }, [round.publicKey, hasEnteredRound]);

  const handleEnter = async () => {
    setSwapError(null);
    setStatus("Preparing transaction...");

    try {
      const isSOL = selectedToken.mint === WSOL_MINT.toBase58();
      const rawAmount = isSOL
        ? undefined
        : Math.floor(
            parseFloat(amount || "0") * 10 ** selectedToken.decimals
          ).toString();

      setStatus(
        isSOL ? "Entering round..." : "Swapping via Jupiter & entering..."
      );

      const txSig = await enterRound(
        round.publicKey,
        isSOL ? undefined : selectedToken.mint,
        rawAmount
      );

      setStatus(`Success! Tx: ${txSig.slice(0, 8)}...`);
      setAmount("");
      setJoined(true);
    } catch (err: any) {
      setSwapError(err.message || "Transaction failed");
      setStatus(null);
    }
  };

  const entryFeeSOL = round.account.entryFeeLamports / LAMPORTS_PER_SOL;

  // Already joined — show confirmation state
  if (joined) {
    return (
      <div className="card-glass p-5">
        <h4 className="text-sm font-medium text-accent-cyan mb-3">
          Enter Round
        </h4>
        <div className="mb-3 bg-accent-green/5 rounded-xl p-4 border border-accent-green/20 text-center">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <svg className="w-5 h-5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-accent-green">Joined the Round</p>
          </div>
          <p className="text-[11px] text-text-dim">
            You paid {entryFeeSOL.toFixed(3)} SOL entry fee. Submit your guess below!
          </p>
        </div>
        <button
          disabled
          className="w-full py-3 rounded-xl font-medium text-sm bg-bg-elevated border border-border text-text-dim cursor-not-allowed opacity-60"
        >
          Already Entered
        </button>
      </div>
    );
  }

  return (
    <div className="card-glass p-5">
      <h4 className="text-sm font-medium text-accent-cyan mb-3">
        Enter Round
      </h4>

      {/* Token Selector — Jupiter swaps only on mainnet */}
      {!IS_DEVNET && (
        <div className="mb-3">
          <label className="text-[11px] uppercase tracking-wider text-text-dim mb-1.5 block">
            Pay with
          </label>
          <div className="flex gap-2">
            {TOKEN_LIST.map((token) => (
              <button
                key={token.mint}
                onClick={() => setSelectedToken(token)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                  selectedToken.mint === token.mint
                    ? "bg-accent-purple/10 border border-accent-purple/30 text-text-primary"
                    : "bg-bg-elevated border border-border text-text-secondary hover:border-border-light"
                }`}
              >
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="w-5 h-5 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {token.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount Input (for non-SOL tokens, mainnet only) */}
      {!IS_DEVNET && selectedToken.mint !== WSOL_MINT.toBase58() && (
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">
            Amount of {selectedToken.symbol}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount in ${selectedToken.symbol}`}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/20 transition-all"
            min="0"
            step="0.001"
          />
          <p className="text-[11px] text-text-dim mt-1.5">
            Will be swapped to {entryFeeSOL.toFixed(3)} SOL via Jupiter
          </p>
        </div>
      )}

      {/* SOL direct entry info */}
      {(IS_DEVNET || selectedToken.mint === WSOL_MINT.toBase58()) && (
        <div className="mb-3 bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Fixed entry fee</p>
          <p className="text-lg font-bold text-accent-green font-mono">
            {entryFeeSOL.toFixed(3)} SOL
          </p>
          <p className="text-[11px] text-text-dim mt-0.5">All entry fees go into the pot</p>
          {IS_DEVNET && (
            <p className="text-[11px] text-accent-amber mt-1">Devnet — Jupiter token swaps available on mainnet</p>
          )}
        </div>
      )}

      {/* Enter Button */}
      <button
        onClick={handleEnter}
        disabled={
          txPending ||
          checkingEntry ||
          !round.account.isActive ||
          (!IS_DEVNET && selectedToken.mint !== WSOL_MINT.toBase58() && !amount)
        }
        className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent-purple to-accent-cyan hover:opacity-90"
      >
        {checkingEntry
          ? "Checking..."
          : txPending
          ? "Processing..."
          : `Enter Round #${round.account.id} — ${entryFeeSOL.toFixed(3)} SOL`}
      </button>

      {/* Status / Error */}
      {status && (
        <p className="text-[11px] text-accent-green mt-2">{status}</p>
      )}
      {swapError && (
        <p className="text-[11px] text-red-400 mt-2">{swapError}</p>
      )}
    </div>
  );
}
