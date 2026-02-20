"use client";

import { useState } from "react";
import { TOKEN_LIST, WSOL_MINT, IS_DEVNET } from "@/lib/constants";
import type { TokenInfo } from "@/lib/types";

/**
 * Standalone Jupiter swap panel — swap any SPL token → SOL.
 * Completely independent of the game / rounds.
 * On devnet it shows a placeholder; on mainnet it calls the Jupiter API.
 */
export default function SwapPanel({ onClose }: { onClose: () => void }) {
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(
    TOKEN_LIST.find((t) => t.mint !== WSOL_MINT.toBase58()) ?? TOKEN_LIST[0]
  );
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

  const nonSolTokens = TOKEN_LIST.filter((t) => t.mint !== WSOL_MINT.toBase58());

  const handleSwap = async () => {
    if (IS_DEVNET) {
      setSwapError("Jupiter swaps are only available on mainnet.");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setSwapError("Enter a valid amount");
      return;
    }
    setSwapping(true);
    setSwapError(null);
    setStatus("Fetching best route from Jupiter...");

    try {
      const inputMint = selectedToken.mint;
      const outputMint = WSOL_MINT.toBase58();
      const rawAmount = Math.floor(parseFloat(amount) * 10 ** selectedToken.decimals);

      const quoteRes = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}&slippageBps=50`
      );
      if (!quoteRes.ok) throw new Error("Jupiter quote failed");
      const quote = await quoteRes.json();

      setStatus(`Route found — swapping ${amount} ${selectedToken.symbol} → SOL...`);

      // In a real implementation you'd call jup.ag /swap, sign, and send the tx.
      // For now this demonstrates the UI flow.
      setStatus(`Swap would convert ${amount} ${selectedToken.symbol} to ~${(quote.outAmount / 1e9).toFixed(4)} SOL`);
      setAmount("");
    } catch (err: any) {
      setSwapError(err.message || "Swap failed");
      setStatus(null);
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md card-glass p-6 animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">Jupiter Swap</h3>
              <p className="text-[11px] text-text-dim">Swap any token → SOL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-bg-elevated border border-border flex items-center justify-center text-text-dim hover:text-text-primary hover:border-border-light transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {IS_DEVNET && (
          <div className="mb-4 bg-accent-amber/5 border border-accent-amber/20 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-xs font-medium text-accent-amber">Devnet Mode</p>
            </div>
            <p className="text-[11px] text-text-dim">
              Jupiter token swaps are only available on mainnet. This panel will be fully functional after mainnet deployment.
            </p>
          </div>
        )}

        {/* Token Selector */}
        <div className="mb-3">
          <label className="text-[11px] uppercase tracking-wider text-text-dim mb-1.5 block">
            From Token
          </label>
          <div className="flex flex-wrap gap-2">
            {nonSolTokens.length > 0 ? (
              nonSolTokens.map((token) => (
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
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {token.symbol}
                </button>
              ))
            ) : (
              <p className="text-sm text-text-dim">No non-SOL tokens configured</p>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center my-2">
          <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center">
            <svg className="w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </div>
        </div>

        {/* To SOL */}
        <div className="mb-4">
          <label className="text-[11px] uppercase tracking-wider text-text-dim mb-1.5 block">
            To
          </label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
            SOL
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="text-[11px] uppercase tracking-wider text-text-dim mb-1.5 block">
            Amount of {selectedToken.symbol}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`0.00 ${selectedToken.symbol}`}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent-purple/50 focus:ring-1 focus:ring-accent-purple/20 transition-all"
            min="0"
            step="0.001"
            disabled={IS_DEVNET}
          />
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={swapping || IS_DEVNET || !amount}
          className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-accent-cyan to-accent-purple hover:opacity-90"
        >
          {swapping ? "Swapping..." : IS_DEVNET ? "Available on Mainnet" : `Swap ${selectedToken.symbol} → SOL`}
        </button>

        {/* Status / Error */}
        {status && <p className="text-[11px] text-accent-green mt-2">{status}</p>}
        {swapError && <p className="text-[11px] text-red-400 mt-2">{swapError}</p>}

        <p className="text-[10px] text-text-dim mt-3 text-center">
          Powered by Jupiter Aggregator
        </p>
      </div>
    </div>
  );
}
