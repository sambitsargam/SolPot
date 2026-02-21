/**
 * Arcium confidential computation client for SolPot Arena.
 *
 * Uses the official @arcium-hq/client SDK:
 * - x25519 ECDH key exchange (client ↔ MXE shared secret)
 * - RescueCipher (Rescue-Prime symmetric cipher in CTR mode)
 * - sha256 for on-chain hash comparison
 *
 * Architecture (production):
 *   1. Client generates ephemeral x25519 keypair
 *   2. Client fetches MXE's x25519 public key
 *   3. Derive shared secret via x25519 ECDH
 *   4. Encrypt guess with RescueCipher using the shared secret
 *   5. Submit ciphertext + nonce + pubkey to on-chain program
 *   6. MPC cluster decrypts and verifies inside the MXE
 *   7. Result returned via callback instruction
 *
 * For the hackathon demo, the on-chain program uses SHA-256 hash comparison
 * as a fallback verifier. In production, the MXE would replace this with
 * full MPC verification on encrypted data.
 *
 * References:
 *   - Arcium docs: https://docs.arcium.com/developers/js-client-library
 *   - Encryption: https://docs.arcium.com/developers/encryption
 *   - Computation lifecycle: https://docs.arcium.com/developers/computation-lifecycle
 */

import { RescueCipher, x25519, sha256, deserializeLE } from "@arcium-hq/client";

// ── Types ───────────────────────────────────────────────────────

export interface ArciumKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface ArciumEncryptedPayload {
  /** RescueCipher ciphertext blocks — each element is a [u8; 32] */
  ciphertext: Uint8Array[];
  /** 16-byte random nonce */
  nonce: Uint8Array;
  /** Client's ephemeral x25519 public key (sent to MXE for decryption) */
  clientPublicKey: Uint8Array;
}

// ── MXE Public Key (simulated for devnet) ───────────────────────
// In production, this is fetched via getMXEPublicKey() from the deployed MXE.
// For the hackathon demo, we use a deterministic key derived from the game
// authority so the flow is reproducible on devnet.

const GAME_MXE_PRIVATE_KEY = (() => {
  // Derive a deterministic x25519 private key from the game authority seed.
  // In production, this key lives inside the MXE and is never exposed.
  const seed = sha256(
    [new TextEncoder().encode("solpot-arena-mxe-devnet-v1")]
  );
  return seed.slice(0, 32);
})();

/** The MXE's x25519 public key — published for clients to encrypt against */
export const MXE_PUBLIC_KEY = x25519.getPublicKey(GAME_MXE_PRIVATE_KEY);

// ── Key Generation ──────────────────────────────────────────────

/**
 * Generate an ephemeral x25519 keypair for a single guess submission.
 * Mirrors the Arcium client flow: each computation uses a fresh keypair.
 */
export function generateKeyPair(): ArciumKeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

// ── Encryption (Arcium RescueCipher) ────────────────────────────

/**
 * Encrypt a guess using Arcium's RescueCipher.
 *
 * Flow (matches Arcium docs):
 *   1. x25519 ECDH → shared secret
 *   2. RescueCipher(sharedSecret) → cipher (internally derives key via Rescue-Prime hash)
 *   3. cipher.encrypt(plaintext, nonce) → ciphertext blocks
 *
 * Each plaintext value is a BigInt field element. We encode the guess as
 * UTF-8 bytes, then pack each byte as a separate field element for
 * compatibility with Arcium's per-element encryption.
 */
export function encryptGuess(
  guess: string,
  clientPrivateKey: Uint8Array,
  mxePublicKey: Uint8Array = MXE_PUBLIC_KEY
): ArciumEncryptedPayload {
  // Step 1: x25519 ECDH key exchange with the MXE
  const sharedSecret = x25519.getSharedSecret(clientPrivateKey, mxePublicKey);

  // Step 2: Initialize RescueCipher with the shared secret
  const cipher = new RescueCipher(sharedSecret);

  // Step 3: Encode guess as BigInt field elements (one per byte)
  const guessBytes = new TextEncoder().encode(guess.toLowerCase());
  const plaintext = Array.from(guessBytes).map((b) => BigInt(b));

  // Step 4: Generate random 16-byte nonce (required by Arcium)
  const nonce = crypto.getRandomValues(new Uint8Array(16));

  // Step 5: Encrypt with RescueCipher
  const rawCiphertext = cipher.encrypt(plaintext, nonce);
  const ciphertext = rawCiphertext.map((block: number[]) => new Uint8Array(block));

  return {
    ciphertext,
    nonce,
    clientPublicKey: x25519.getPublicKey(clientPrivateKey),
  };
}

/**
 * Decrypt a guess from its Arcium encrypted payload.
 * In production, this runs inside the MXE (MPC cluster).
 * For devnet testing, we use the simulated MXE private key.
 */
export function decryptGuess(
  payload: ArciumEncryptedPayload,
  mxePrivateKey: Uint8Array = GAME_MXE_PRIVATE_KEY
): string {
  const sharedSecret = x25519.getSharedSecret(mxePrivateKey, payload.clientPublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const ciphertextArrays = payload.ciphertext.map((block) => Array.from(block));
  const plaintext = cipher.decrypt(ciphertextArrays, payload.nonce);
  const bytes = plaintext.map((v) => Number(v));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ── SHA-256 Hashing ─────────────────────────────────────────────

/**
 * Compute SHA-256 hash of a word (matches on-chain `solana_program::hash::hash`).
 * Used for on-chain verification via hash comparison.
 */
export function hashWord(word: string): Uint8Array {
  return sha256([new TextEncoder().encode(word.toLowerCase())]);
}

// ── Full Encrypted Guess Flow ───────────────────────────────────

/**
 * Prepare an encrypted guess for submission:
 *   1. Generate ephemeral x25519 keypair
 *   2. Derive shared secret with game's MXE public key
 *   3. Encrypt guess with RescueCipher
 *   4. Compute SHA-256 hash for on-chain verification
 *
 * Returns the encrypted payload (for MXE verification in production)
 * and the hash (for SHA-256 fallback verification on devnet).
 */
export function prepareEncryptedGuess(
  guess: string,
  mxePublicKey: Uint8Array = MXE_PUBLIC_KEY
): {
  encryptedPayload: ArciumEncryptedPayload;
  guessHash: Uint8Array;
  ephemeralKeyPair: ArciumKeyPair;
} {
  const keyPair = generateKeyPair();
  const encryptedPayload = encryptGuess(guess, keyPair.privateKey, mxePublicKey);

  return {
    encryptedPayload,
    guessHash: hashWord(guess),
    ephemeralKeyPair: keyPair,
  };
}

/**
 * Serialize an ArciumEncryptedPayload for on-chain storage.
 * Encodes the ciphertext blocks, nonce, and client public key into
 * a single Uint8Array that can be passed as instruction data.
 */
export function serializeEncryptedPayload(
  payload: ArciumEncryptedPayload
): Uint8Array {
  const blockCount = payload.ciphertext.length;
  // Format: [1 byte blockCount] [blockCount * 32 bytes ciphertext] [16 bytes nonce] [32 bytes pubkey]
  const totalSize = 1 + blockCount * 32 + 16 + 32;
  const result = new Uint8Array(totalSize);
  let offset = 0;

  result[offset++] = blockCount;
  for (const block of payload.ciphertext) {
    result.set(block, offset);
    offset += 32;
  }
  result.set(payload.nonce, offset);
  offset += 16;
  result.set(payload.clientPublicKey, offset);

  return result;
}

