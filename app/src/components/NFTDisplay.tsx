"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore, fetchAssetsByOwner } from "@metaplex-foundation/mpl-core";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { RPC_URL } from "@/lib/constants";

interface CoreAsset {
  address: string;
  name: string;
  uri: string;
}

export default function NFTDisplay() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [nfts, setNfts] = useState<CoreAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;

    const fetchNFTs = async () => {
      setLoading(true);
      try {
        // Create Umi instance with Metaplex Core plugin
        const umi = createUmi(RPC_URL).use(mplCore());

        // Fetch all Core assets owned by this wallet via the official SDK
        const assets = await fetchAssetsByOwner(
          umi,
          umiPublicKey(publicKey.toBase58())
        );

        // Filter for SolPot trophies
        const solpotAssets: CoreAsset[] = assets
          .filter(
            (a) =>
              a.name.includes("SolPot") || a.name.includes("SOLPOT")
          )
          .map((a) => ({
            address: a.publicKey.toString(),
            name: a.name,
            uri: a.uri,
          }));

        setNfts(solpotAssets);
      } catch (err) {
        console.error("Failed to fetch Core assets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [connection, publicKey]);

  return (
    <div className="card-glass p-5">
      <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
        NFT Trophies
      </h3>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-bg-elevated rounded-xl p-3 animate-pulse h-16 border border-border"
            />
          ))}
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
            <svg
              className="w-6 h-6 text-text-dim"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <p className="text-text-muted text-sm">No SolPot NFTs yet</p>
          <p className="text-text-dim text-xs mt-1">
            Win a round to earn your first trophy!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {nfts.map((nft) => (
            <div
              key={nft.address}
              className="bg-bg-elevated rounded-xl p-3 flex items-center gap-3 border border-border hover:border-border-light transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center text-sm font-bold">
                SP
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {nft.name}
                </p>
                <p className="text-[11px] text-text-dim font-mono truncate">
                  {nft.address.slice(0, 8)}...{nft.address.slice(-4)}
                </p>
              </div>
              <a
                href={`https://core.metaplex.com/explorer/${nft.address}?env=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-accent-violet hover:text-accent-purple transition-colors"
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
