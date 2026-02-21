"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { MPL_CORE_PROGRAM_ID } from "@/lib/constants";

interface CoreAsset {
  address: string;
  name: string;
  uri: string;
}

/**
 * Parse a Metaplex Core asset account's data to extract name and URI.
 * Core asset layout (simplified):
 *   [0]      key (1 byte, Key::AssetV1 = 1)
 *   [1..33]  owner (32 bytes)
 *   [33..34] update_authority type (1 byte)
 *   [34..66] update_authority address (32 bytes)
 *   [66..70] name length (4 bytes LE borsh String)
 *   [70..70+nameLen] name UTF-8 bytes
 *   Then uri length + uri
 */
function parseCoreAsset(
  address: string,
  data: Buffer
): CoreAsset | null {
  try {
    const key = data[0];
    // Key::AssetV1 = 1
    if (key !== 1) return null;

    let offset = 1 + 32; // skip key + owner

    // update_authority: enum discriminator (1 byte) + optional pubkey (32 bytes)
    const uaType = data[offset];
    offset += 1;
    if (uaType === 1 || uaType === 2) {
      // Address or Collection - has a 32-byte pubkey
      offset += 32;
    }

    // name (borsh String: 4-byte LE length + UTF-8 bytes)
    if (offset + 4 > data.length) return null;
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    if (offset + nameLen > data.length || nameLen > 200) return null;
    const name = data
      .subarray(offset, offset + nameLen)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    offset += nameLen;

    // uri (borsh String: 4-byte LE length + UTF-8 bytes)
    if (offset + 4 > data.length) return null;
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    if (offset + uriLen > data.length || uriLen > 500) return null;
    const uri = data
      .subarray(offset, offset + uriLen)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();

    return { address, name, uri };
  } catch {
    return null;
  }
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
        // Fetch all Metaplex Core assets owned by this wallet using GPA
        const accounts = await connection.getProgramAccounts(
          MPL_CORE_PROGRAM_ID,
          {
            filters: [
              { memcmp: { offset: 1, bytes: publicKey.toBase58() } }, // owner at offset 1
            ],
          }
        );

        const solpotAssets: CoreAsset[] = [];
        for (const { pubkey, account } of accounts) {
          const asset = parseCoreAsset(
            pubkey.toBase58(),
            account.data as Buffer
          );
          if (
            asset &&
            (asset.name.includes("SolPot") || asset.name.includes("SOLPOT"))
          ) {
            solpotAssets.push(asset);
          }
        }

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
