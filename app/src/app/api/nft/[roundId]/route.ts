import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { roundId: string } }
) {
  const roundId = params.roundId;

  return NextResponse.json({
    name: `SolPot Winner #${roundId}`,
    description: `This NFT certifies the winner of Round #${roundId} in SolPot Arena — an on-chain multi-game arena on Solana featuring Jupiter swaps, Arcium encryption, and Metaplex Core NFT rewards.`,
    image:
      "https://bafybeiahrdgs6raqp7e3ww2ki7wibdjs76dit53gqpc6ver2pqamafloce.ipfs.spfs-gateway.thestratos.net/",
    external_url: "https://solpot.app",
    attributes: [
      { trait_type: "Game", value: "SolPot Arena" },
      { trait_type: "Round", value: `#${roundId}` },
      { trait_type: "Network", value: "Solana Devnet" },
      { trait_type: "Reward", value: "Winner Trophy" },
    ],
    properties: {
      category: "image",
      files: [
        {
          uri: "https://bafybeiahrdgs6raqp7e3ww2ki7wibdjs76dit53gqpc6ver2pqamafloce.ipfs.spfs-gateway.thestratos.net/",
          type: "image/png",
        },
      ],
    },
  });
}
