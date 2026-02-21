import { Connection, PublicKey } from "@solana/web3.js";

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const PROGRAM_ID = new PublicKey("22tsqvygTkEoomxNduhqEPYKA3DXfPPzNLXVxv9DAp8A");
const [gameConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("game_config")], PROGRAM_ID);
const info = await conn.getAccountInfo(gameConfigPda);
if (!info) { console.log("Game NOT initialized"); process.exit(0); }
const data = info.data;
const roundCount = Number(data.readBigUInt64LE(8 + 32));
console.log("Game Config PDA:", gameConfigPda.toBase58());
console.log("Round count:", roundCount);
console.log("Entry fee:", Number(data.readBigUInt64LE(8 + 32 + 8)) / 1e9, "SOL");
console.log("Fee BPS:", data.readUInt16LE(8 + 32 + 8 + 8));
