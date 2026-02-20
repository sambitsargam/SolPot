"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TOKEN_METADATA_PROGRAM_ID } from "@/lib/constants";

interface NFTMeta {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
}

export default function NFTDisplay() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [nfts, setNfts] = useState<NFTMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;

    const fetchNFTs = async () => {
      setLoading(true);
      try {
        // Fetch all token accounts owned by the user
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );

        const nftMints: NFTMeta[] = [];

        for (const { account } of tokenAccounts.value) {
          const parsed = account.data.parsed;
          const info = parsed.info;
          const amount = info.tokenAmount;

          // NFTs have decimals=0 and amount=1
          if (
            amount.decimals === 0 &&
            amount.uiAmount === 1
          ) {
            const mintPubkey = new PublicKey(info.mint);

            // Derive metadata PDA
            const [metadataPda] = PublicKey.findProgramAddressSync(
              [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mintPubkey.toBuffer(),
              ],
              TOKEN_METADATA_PROGRAM_ID
            );

            try {
              const metadataAccount =
                await connection.getAccountInfo(metadataPda);
              if (metadataAccount) {
                // Parse metadata (simplified — reads name, symbol, uri from raw bytes)
                const metadata = parseMetadata(metadataAccount.data);
                if (
                  metadata &&
                  (metadata.name.includes("SolPot") ||
                    metadata.symbol === "SOLPOT")
                ) {
                  nftMints.push({
                    mint: info.mint,
                    ...metadata,
                  });
                }
              }
            } catch {
              // Skip if metadata fetch fails
            }
          }
        }

        setNfts(nftMints);
      } catch (err) {
        console.error("Failed to fetch NFTs:", err);
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
              key={nft.mint}
              className="bg-bg-elevated rounded-xl p-3 flex items-center gap-3 border border-border hover:border-border-light transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center text-sm font-bold">
                {nft.symbol.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{nft.name}</p>
                <p className="text-[11px] text-text-dim font-mono truncate">
                  {nft.mint.slice(0, 8)}...{nft.mint.slice(-4)}
                </p>
              </div>
              <a
                href={`https://explorer.solana.com/address/${nft.mint}?cluster=devnet`}
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

/**
 * Minimal Metaplex metadata parser.
 * Reads name, symbol, and URI from the raw metadata account bytes.
 * See: https://developers.metaplex.com/token-metadata
 */
function parseMetadata(
  data: Buffer
): { name: string; symbol: string; uri: string } | null {
  try {
    // Metadata account layout (simplified):
    // [0]     key (1 byte)
    // [1..33] update_authority (32 bytes)
    // [33..65] mint (32 bytes)
    // [65..69] name length (4 bytes LE)
    // [69..69+len] name
    // Then symbol length + symbol
    // Then uri length + uri

    let offset = 1 + 32 + 32; // Skip key + update_authority + mint

    // Read name
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data
      .subarray(offset, offset + nameLen)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    offset += nameLen;

    // Read symbol
    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data
      .subarray(offset, offset + symbolLen)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    offset += symbolLen;

    // Read URI
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data
      .subarray(offset, offset + uriLen)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();

    return { name, symbol, uri };
  } catch {
    return null;
  }
}
