"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { RPC_URL } from "@/lib/constants";
import { GameProvider } from "@/contexts/GameContext";

import "@solana/wallet-adapter-react-ui/styles.css";

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = RPC_URL;

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <GameProvider>{children}</GameProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
