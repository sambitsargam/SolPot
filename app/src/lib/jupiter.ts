import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { JUPITER_API_BASE, JUPITER_API_KEY, WSOL_MINT } from "./constants";
import type { JupiterQuoteResponse, JupiterSwapInstructionsResponse } from "./types";

/**
 * Fetch a swap quote from Jupiter Metis API.
 * Uses the real Jupiter `/quote` endpoint.
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string, // raw amount (before decimals)
  slippageBps: number = 50
): Promise<JupiterQuoteResponse> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: slippageBps.toString(),
    swapMode: "ExactIn",
    restrictIntermediateTokens: "true",
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }

  const response = await fetch(`${JUPITER_API_BASE}/quote?${params}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jupiter quote failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch swap instructions from Jupiter Metis API.
 * Returns individual instructions that can be composed with game entry.
 */
export async function getJupiterSwapInstructions(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string
): Promise<JupiterSwapInstructionsResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }

  const response = await fetch(`${JUPITER_API_BASE}/swap-instructions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          priorityLevel: "high",
          maxLamports: 500000,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jupiter swap-instructions failed: ${response.status} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Deserialize a Jupiter instruction from JSON format into a TransactionInstruction.
 */
function deserializeInstruction(
  instruction: {
    programId: string;
    accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
    data: string;
  }
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((acc) => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  });
}

/**
 * Build a versioned transaction that:
 * 1. Swaps user's token to SOL via Jupiter
 * 2. Appends the game entry instruction
 *
 * This allows users to enter the game with ANY SPL token.
 */
export async function buildSwapAndEnterTransaction(
  connection: Connection,
  userPublicKey: PublicKey,
  inputMint: string,
  inputAmount: string,
  gameEntryInstruction: TransactionInstruction,
  slippageBps: number = 50
): Promise<VersionedTransaction> {
  // If paying with SOL directly, no swap needed
  if (inputMint === WSOL_MINT.toBase58()) {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const messageV0 = new TransactionMessage({
      payerKey: userPublicKey,
      recentBlockhash: blockhash,
      instructions: [gameEntryInstruction],
    }).compileToV0Message();

    return new VersionedTransaction(messageV0);
  }

  // Get Jupiter quote: inputToken → SOL
  const quote = await getJupiterQuote(
    inputMint,
    WSOL_MINT.toBase58(),
    inputAmount,
    slippageBps
  );

  // Get individual swap instructions (composable)
  const swapIxs = await getJupiterSwapInstructions(
    quote,
    userPublicKey.toBase58()
  );

  // Build all instructions in order
  const instructions: TransactionInstruction[] = [];

  // 1. Compute budget instructions
  for (const ix of swapIxs.computeBudgetInstructions) {
    instructions.push(deserializeInstruction(ix));
  }

  // 2. Setup instructions (token account creation, etc.)
  for (const ix of swapIxs.setupInstructions) {
    instructions.push(deserializeInstruction(ix));
  }

  // 3. The swap instruction itself
  instructions.push(deserializeInstruction(swapIxs.swapInstruction));

  // 4. Cleanup instruction (unwrap WSOL, etc.)
  if (swapIxs.cleanupInstruction) {
    instructions.push(deserializeInstruction(swapIxs.cleanupInstruction));
  }

  // 5. Game entry instruction (appended after swap)
  instructions.push(gameEntryInstruction);

  // Fetch address lookup tables for versioned transaction
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  if (swapIxs.addressLookupTableAddresses?.length > 0) {
    const lookupTablePromises = swapIxs.addressLookupTableAddresses.map(
      (addr) => connection.getAddressLookupTable(new PublicKey(addr))
    );
    const lookupTables = await Promise.all(lookupTablePromises);
    for (const lt of lookupTables) {
      if (lt.value) {
        addressLookupTableAccounts.push(lt.value);
      }
    }
  }

  // Build versioned transaction
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: userPublicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(addressLookupTableAccounts);

  return new VersionedTransaction(messageV0);
}

/**
 * Fetch a Jupiter swap transaction (full base64-encoded unsigned tx).
 * Alternative to swap-instructions when composition isn't needed.
 */
export async function getJupiterSwapTransaction(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }

  const response = await fetch(`${JUPITER_API_BASE}/swap`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          priorityLevel: "high",
          maxLamports: 500000,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jupiter swap failed: ${response.status} - ${errorText}`);
  }

  const { swapTransaction } = await response.json();
  return swapTransaction;
}
