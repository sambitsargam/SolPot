"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Keypair } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  getProgram,
  getProvider,
  getReadOnlyProgram,
  getGameConfigPda,
  getLeaderboardPda,
  getRoundPda,
  getPlayerEntryPda,
  getGuessRecordPda,
  fetchGameConfig,
  fetchAllRounds,
  fetchRound,
  buildEnterRoundIx,
  buildSubmitGuessIx,
} from "@/lib/program";
import { MPL_CORE_PROGRAM_ID, RPC_URL, WSOL_MINT } from "@/lib/constants";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore, createV1 } from "@metaplex-foundation/mpl-core";
import { generateSigner } from "@metaplex-foundation/umi";
import { buildSwapAndEnterTransaction } from "@/lib/jupiter";
import type { GameConfigAccount, RoundAccount } from "@/lib/types";

export interface RoundWithKey {
  publicKey: PublicKey;
  account: RoundAccount;
}

interface GameContextValue {
  gameConfig: GameConfigAccount | null;
  rounds: RoundWithKey[];
  loading: boolean;
  error: string | null;
  txPending: boolean;
  enterRound: (roundPda: PublicKey, inputMint?: string, inputAmount?: string) => Promise<string>;
  submitGuess: (roundPda: PublicKey, guess: string) => Promise<string>;
  distributePot: (roundPda: PublicKey, winnerPubkey: PublicKey) => Promise<string>;
  mintRewardNft: (roundPda: PublicKey, winnerPubkey: PublicKey, roundId: number) => Promise<string>;
  hasEnteredRound: (roundPda: PublicKey) => Promise<boolean>;
  hasGuessedInRound: (roundPda: PublicKey) => Promise<boolean>;
  checkGuessResult: (roundPda: PublicKey) => Promise<boolean>;
  refreshState: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
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

  // Fetch game state — works without wallet using read-only provider
  const refreshState = useCallback(async () => {
    try {
      setLoading(true);

      // Use wallet provider if available, otherwise read-only
      const provider = getAnchorProvider();
      const program = provider
        ? getProgram(provider)
        : getReadOnlyProgram(connection);

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
  }, [connection, getAnchorProvider]);

  // Initial fetch + re-fetch when wallet connects/disconnects
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

        const enterIx = await buildEnterRoundIx(
          program,
          roundPda,
          gameConfigPda,
          wallet.publicKey
        );

        let txSig: string;

        if (inputMint && inputMint !== WSOL_MINT.toBase58() && inputAmount) {
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
            guessRecord: getGuessRecordPda(roundPda, wallet.publicKey)[0],
            player: wallet.publicKey,
            systemProgram: SystemProgram.programId,
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

  // Mint winner NFT using Metaplex Core SDK
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

        const assetKeypair = Keypair.generate();

        const name = `SolPot Winner #${roundId}`;
        const uri = `https://solpot-arena.vercel.app/api/nft/${roundId}`;

        const txSig = await program.methods
          .mintRewardNft(name, uri)
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

      try {
        const [playerEntryPda] = getPlayerEntryPda(roundPda, wallet.publicKey);
        const info = await connection.getAccountInfo(playerEntryPda);
        return info !== null;
      } catch {
        return false;
      }
    },
    [connection, wallet.publicKey]
  );

  // Check if current user has already guessed in a specific round
  const hasGuessedInRound = useCallback(
    async (roundPda: PublicKey): Promise<boolean> => {
      if (!wallet.publicKey) return false;

      try {
        const [guessRecordPda] = getGuessRecordPda(roundPda, wallet.publicKey);
        const info = await connection.getAccountInfo(guessRecordPda);
        return info !== null;
      } catch {
        return false;
      }
    },
    [connection, wallet.publicKey]
  );

  // Check if the current player won after submitting a guess
  const checkGuessResult = useCallback(
    async (roundPda: PublicKey): Promise<boolean> => {
      try {
        const program = getAnchorProvider()
          ? getProgram(getAnchorProvider()!)
          : getReadOnlyProgram(connection);
        const roundData = await fetchRound(program, roundPda);
        if (!roundData) return false;
        return (
          roundData.hasWinner &&
          wallet.publicKey !== null &&
          roundData.winner.equals(wallet.publicKey)
        );
      } catch {
        return false;
      }
    },
    [connection, wallet.publicKey, getAnchorProvider]
  );

  const value = useMemo<GameContextValue>(
    () => ({
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
      hasGuessedInRound,
      checkGuessResult,
      refreshState,
    }),
    [
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
      hasGuessedInRound,
      checkGuessResult,
      refreshState,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGameContext must be used within <GameProvider>");
  }
  return ctx;
}
