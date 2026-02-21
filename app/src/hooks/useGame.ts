"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  getProgram,
  getProvider,
  getGameConfigPda,
  getLeaderboardPda,
  getRoundPda,
  getPlayerEntryPda,
  fetchGameConfig,
  fetchAllRounds,
  fetchRound,
  buildEnterRoundIx,
  buildSubmitGuessIx,
} from "@/lib/program";
import { MPL_CORE_PROGRAM_ID } from "@/lib/constants";
import {
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { buildSwapAndEnterTransaction } from "@/lib/jupiter";
import { WSOL_MINT } from "@/lib/constants";
import type { GameConfigAccount, RoundAccount } from "@/lib/types";

export interface RoundWithKey {
  publicKey: PublicKey;
  account: RoundAccount;
}

export function useGame() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [gameConfig, setGameConfig] = useState<GameConfigAccount | null>(null);
  const [rounds, setRounds] = useState<RoundWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);

  const getAnchorProvider = useCallback((): AnchorProvider | null => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return getProvider(connection, wallet);
  }, [connection, wallet]);

  // Fetch game state
  const refreshState = useCallback(async () => {
    const provider = getAnchorProvider();
    if (!provider) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const program = getProgram(provider);

      const [config, allRounds] = await Promise.all([
        fetchGameConfig(program).catch(() => null),
        fetchAllRounds(program).catch(() => []),
      ]);

      setGameConfig(config);
      setRounds(
        allRounds.sort((a, b) => b.account.createdAt - a.account.createdAt)
      );
      if (!config) {
        setError("Game not initialized yet");
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch game state:", err);
      setError("Game not initialized yet");
    } finally {
      setLoading(false);
    }
  }, [getAnchorProvider]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Enter a round (with optional token swap via Jupiter)
  const enterRound = useCallback(
    async (
      roundPda: PublicKey,
      inputMint?: string,
      inputAmount?: string
    ): Promise<string> => {
      const provider = getAnchorProvider();
      if (!provider || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }

      setTxPending(true);
      setError(null);

      try {
        const program = getProgram(provider);
        const [gameConfigPda] = getGameConfigPda();

        // Build the game entry instruction
        const enterIx = await buildEnterRoundIx(
          program,
          roundPda,
          gameConfigPda,
          wallet.publicKey
        );

        let txSig: string;

        if (inputMint && inputMint !== WSOL_MINT.toBase58() && inputAmount) {
          // Swap token to SOL via Jupiter, then enter
          const tx = await buildSwapAndEnterTransaction(
            connection,
            wallet.publicKey,
            inputMint,
            inputAmount,
            enterIx
          );

          const signed = await wallet.signTransaction(tx);
          txSig = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          });
        } else {
          // Direct SOL entry
          const tx = await buildSwapAndEnterTransaction(
            connection,
            wallet.publicKey,
            WSOL_MINT.toBase58(),
            "0",
            enterIx
          );

          const signed = await wallet.signTransaction(tx);
          txSig = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          });
        }

        await connection.confirmTransaction(txSig, "confirmed");
        await refreshState();
        return txSig;
      } catch (err: any) {
        const msg = err.message || "Failed to enter round";
        setError(msg);
        throw new Error(msg);
      } finally {
        setTxPending(false);
      }
    },
    [connection, wallet, getAnchorProvider, refreshState]
  );

  // Submit a guess
  const submitGuess = useCallback(
    async (roundPda: PublicKey, guess: string): Promise<string> => {
      const provider = getAnchorProvider();
      if (!provider || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }

      setTxPending(true);
      setError(null);

      try {
        const program = getProgram(provider);

        const txSig = await program.methods
          .submitGuess(guess)
          .accountsStrict({
            round: roundPda,
            playerEntry: getPlayerEntryPda(roundPda, wallet.publicKey)[0],
            player: wallet.publicKey,
          })
          .rpc({ commitment: "confirmed" });

        await refreshState();
        return txSig;
      } catch (err: any) {
        const msg = err.message || "Failed to submit guess";
        setError(msg);
        throw new Error(msg);
      } finally {
        setTxPending(false);
      }
    },
    [wallet, getAnchorProvider, refreshState]
  );

  // Distribute pot to winner
  const distributePot = useCallback(
    async (roundPda: PublicKey, winnerPubkey: PublicKey): Promise<string> => {
      const provider = getAnchorProvider();
      if (!provider || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }

      setTxPending(true);
      setError(null);

      try {
        const program = getProgram(provider);
        const [gameConfigPda] = getGameConfigPda();
        const [leaderboardPda] = getLeaderboardPda(gameConfigPda);
        const config = await fetchGameConfig(program);
        if (!config) throw new Error("Game not initialized");

        const txSig = await program.methods
          .distributePot()
          .accountsStrict({
            gameConfig: gameConfigPda,
            round: roundPda,
            winner: winnerPubkey,
            feeReceiver: config.authority,
            leaderboard: leaderboardPda,
          })
          .rpc({ commitment: "confirmed" });

        await refreshState();
        return txSig;
      } catch (err: any) {
        const msg = err.message || "Failed to distribute pot";
        setError(msg);
        throw new Error(msg);
      } finally {
        setTxPending(false);
      }
    },
    [wallet, getAnchorProvider, refreshState]
  );

  // Mint winner NFT
  const mintRewardNft = useCallback(
    async (
      roundPda: PublicKey,
      winnerPubkey: PublicKey,
      roundId: number
    ): Promise<string> => {
      const provider = getAnchorProvider();
      if (!provider || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected");
      }

      setTxPending(true);
      setError(null);

      try {
        const program = getProgram(provider);
        const [gameConfigPda] = getGameConfigPda();

        // Generate a new keypair for the Metaplex Core asset
        const assetKeypair = Keypair.generate();

        const txSig = await program.methods
          .mintRewardNft(
            `SolPot Winner #${roundId}`,
            `https://solpot.app/api/nft/${roundId}`
          )
          .accountsStrict({
            gameConfig: gameConfigPda,
            round: roundPda,
            asset: assetKeypair.publicKey,
            winner: winnerPubkey,
            payer: wallet.publicKey,
            mplCoreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([assetKeypair])
          .rpc({ commitment: "confirmed" });

        await refreshState();
        return txSig;
      } catch (err: any) {
        const msg = err.message || "Failed to mint NFT";
        setError(msg);
        throw new Error(msg);
      } finally {
        setTxPending(false);
      }
    },
    [wallet, getAnchorProvider, refreshState]
  );

  // Check if current user has entered a specific round
  const hasEnteredRound = useCallback(
    async (roundPda: PublicKey): Promise<boolean> => {
      if (!wallet.publicKey) return false;
      const provider = getAnchorProvider();
      if (!provider) return false;

      try {
        const [playerEntryPda] = getPlayerEntryPda(roundPda, wallet.publicKey);
        const info = await connection.getAccountInfo(playerEntryPda);
        return info !== null;
      } catch {
        return false;
      }
    },
    [connection, wallet.publicKey, getAnchorProvider]
  );

  return {
    gameConfig,
    rounds,
    loading,
    error,
    txPending,
    enterRound,
    submitGuess,
    distributePot,
    mintRewardNft,
    hasEnteredRound,
    refreshState,
  };
}
