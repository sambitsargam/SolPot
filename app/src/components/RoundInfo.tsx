"use client";

import { useState } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import type { RoundWithKey } from "@/hooks/useGame";

interface RoundInfoProps {
  round: RoundWithKey;
  distributePot?: (roundPda: PublicKey, winner: PublicKey) => Promise<string>;
  mintRewardNft?: (roundPda: PublicKey, winner: PublicKey, roundId: number) => Promise<string>;
  txPending?: boolean;
}

export default function RoundInfo({ round, distributePot, mintRewardNft, txPending = false }: RoundInfoProps) {
  const { account } = round;
  const wallet = useWallet();
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Show original pot size even after distribution
  const originalPotLamports = account.potDistributed
    ? account.playerCount * account.entryFeeLamports
    : account.potLamports;
  const potSOL = originalPotLamports / LAMPORTS_PER_SOL;
  const entryFeeSOL = account.entryFeeLamports / LAMPORTS_PER_SOL;
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = Math.max(0, account.expiresAt - now);
  const isExpired = timeLeft === 0;

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  let winnerStr = "";
  try {
    winnerStr = new PublicKey(account.winner).toBase58();
  } catch {
    winnerStr = "";
  }
  const isWinnerDefault =
    !winnerStr || winnerStr === PublicKey.default.toBase58();
  const isCurrentUserWinner =
    wallet.publicKey != null &&
    !isWinnerDefault &&
    winnerStr === wallet.publicKey.toBase58();

  return (
    <div className="card-glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-text-primary">Round #{account.id}</h3>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
              account.isActive
                ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                : isCurrentUserWinner
                ? "bg-accent-amber/10 text-accent-amber border border-accent-amber/20"
                : account.hasWinner && !isWinnerDefault
                ? "bg-accent-purple/10 text-accent-violet border border-accent-purple/20"
                : "bg-bg-elevated text-text-dim border border-border"
            }`}
          >
            {account.isActive
              ? "Active"
              : isCurrentUserWinner
              ? "You Won!"
              : account.hasWinner && !isWinnerDefault
              ? "Ended"
              : "Closed"}
          </span>
        </div>
        {account.isActive && !isExpired && (
          <span className="text-sm text-text-secondary font-mono">
            {formatTime(timeLeft)} left
          </span>
        )}
        {isExpired && account.isActive && (
          <span className="text-sm text-red-400">Expired</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Pot */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Pot Size</p>
          <p className="text-xl font-bold text-accent-green font-mono">
            {potSOL.toFixed(3)}
          </p>
          <p className="text-[11px] text-text-dim">
            {account.potDistributed ? "SOL (claimed)" : "SOL"}
          </p>
        </div>

        {/* Players */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Players</p>
          <p className="text-xl font-bold text-text-primary font-mono">
            {account.playerCount}
            <span className="text-sm text-text-dim">
              /{account.maxPlayers}
            </span>
          </p>
        </div>

        {/* Entry Fee */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Entry Fee</p>
          <p className="text-xl font-bold text-text-primary font-mono">{entryFeeSOL.toFixed(3)}</p>
          <p className="text-[11px] text-text-dim">SOL (fixed)</p>
        </div>

        {/* Status */}
        <div className="bg-bg-elevated rounded-xl p-3 border border-border">
          <p className="text-[11px] uppercase tracking-wider text-text-dim">Status</p>
          {account.hasWinner && !isWinnerDefault ? (
            <div>
              <p className="text-sm font-bold text-accent-amber">Winner!</p>
              <p className="text-[11px] text-text-dim font-mono truncate">
                {account.winner.toBase58().slice(0, 8)}...
              </p>
            </div>
          ) : account.potDistributed ? (
            <p className="text-sm text-text-muted">Distributed</p>
          ) : (
            <p className="text-sm text-accent-green">
              {account.isActive ? "Guessing" : "Finished"}
            </p>
          )}
        </div>
      </div>

      {/* Winner Actions - only visible to the winner */}
      {account.hasWinner && isCurrentUserWinner && (
        <div className="mt-4 space-y-3">
          {/* Status badges */}
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                account.potDistributed
                  ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                  : "bg-accent-amber/10 text-accent-amber border border-accent-amber/20"
              }`}
            >
              Pot: {account.potDistributed ? "Distributed" : "Ready to claim"}
            </span>
            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                account.nftMinted
                  ? "bg-accent-purple/10 text-accent-violet border border-accent-purple/20"
                  : account.potDistributed
                  ? "bg-accent-amber/10 text-accent-amber border border-accent-amber/20"
                  : "bg-bg-elevated text-text-dim border border-border"
              }`}
            >
              NFT: {account.nftMinted ? "Minted" : account.potDistributed ? "Ready to mint" : "After claim"}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!account.potDistributed && distributePot && (
              <button
                onClick={async () => {
                  setActionError(null);
                  setActionStatus("Distributing pot...");
                  try {
                    const tx = await distributePot(round.publicKey, account.winner);
                    setActionStatus(`Pot distributed! Tx: ${tx.slice(0, 8)}...`);
                  } catch (err: any) {
                    setActionError(err.message || "Failed to distribute pot");
                    setActionStatus(null);
                  }
                }}
                disabled={txPending}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/20 hover:border-accent-green/30"
              >
                {txPending ? "Processing..." : "Claim Prize"}
              </button>
            )}

            {account.potDistributed && !account.nftMinted && mintRewardNft && (
              <button
                onClick={async () => {
                  setActionError(null);
                  setActionStatus("Minting winner NFT...");
                  try {
                    const tx = await mintRewardNft(round.publicKey, account.winner, account.id);
                    setActionStatus(`NFT minted! Tx: ${tx.slice(0, 8)}...`);
                  } catch (err: any) {
                    setActionError(err.message || "Failed to mint NFT");
                    setActionStatus(null);
                  }
                }}
                disabled={txPending}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-accent-purple/10 border border-accent-purple/20 text-accent-violet hover:bg-accent-purple/20 hover:border-accent-purple/30"
              >
                {txPending ? "Processing..." : "Mint Winner NFT"}
              </button>
            )}

            {account.potDistributed && account.nftMinted && (
              <div className="flex-1 py-2.5 rounded-xl text-sm text-center bg-accent-green/5 border border-accent-green/20 text-accent-green">
                All rewards claimed
              </div>
            )}
          </div>

          {/* Status / Error */}
          {actionStatus && (
            <p className="text-[11px] text-accent-green">{actionStatus}</p>
          )}
          {actionError && (
            <p className="text-[11px] text-red-400">{actionError}</p>
          )}
        </div>
      )}
    </div>
  );
}
