"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  getProgram,
  getProvider,
  getReadOnlyProgram,
  fetchLeaderboard,
} from "@/lib/program";
import { getRealTimeManager } from "@/lib/magicblock";
import type { LeaderboardEntryData, GameEvent } from "@/lib/types";

export function useLeaderboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [entries, setEntries] = useState<LeaderboardEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  const getAnchorProvider = useCallback((): AnchorProvider | null => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return getProvider(connection, wallet);
  }, [connection, wallet]);

  // Fetch leaderboard data — works without wallet
  const refresh = useCallback(async () => {
    try {
      const provider = getAnchorProvider();
      const program = provider
        ? getProgram(provider)
        : getReadOnlyProgram(connection);

      const leaderboard = await fetchLeaderboard(program);
      if (leaderboard) {
        setEntries(leaderboard.entries);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, getAnchorProvider]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time updates via WebSocket (Magicblock pattern)
  useEffect(() => {
    const manager = getRealTimeManager();

    const handleEvent = (_event: GameEvent) => {
      // Re-fetch leaderboard on any program state change
      refresh();
    };

    unsubRef.current = manager.subscribe(handleEvent);

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [refresh]);

  return {
    entries,
    loading,
    refresh,
  };
}
