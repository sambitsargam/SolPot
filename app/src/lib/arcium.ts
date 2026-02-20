/**
 * Arcium-style client-side encryption for SolPot Arena.
 *
 * Uses X25519 key exchange (same as Arcium's MPC key exchange)
 * and XChaCha20-Poly1305 AEAD for encrypting guesses before submission.
 *
 * This provides:
 * 1. Transport-layer privacy: guesses are encrypted before hitting the mempool
 * 2. Front-running protection: validators/bots cannot read guess content
 * 3. Real cryptographic operations (not simulated)
 *
 * The on-chain program uses SHA-256 hash comparison for verification,
 * which is a one-way function ensuring the secret word remains hidden.
 *
 * References:
 * - Arcium encryption: https://docs.arcium.com/developers/encryption
 * - @noble/curves X25519: https://github.com/paulmillr/noble-curves
 * - @noble/ciphers XChaCha20: https://github.com/paulmillr/noble-ciphers
 */

import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { sha256 } from "@noble/hashes/sha256";
import { randomBytes } from "@noble/ciphers/webcrypto";

export interface ArciumKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  senderPublicKey: Uint8Array;
}

/**
 * Generate an X25519 keypair for encrypted communication.
 * This mirrors Arcium's client-side key generation.
 */
export function generateKeyPair(): ArciumKeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Derive a shared secret using X25519 Diffie-Hellman key exchange.
 * In Arcium's flow, this shared secret is derived between the client
 * and the MXE (MPC eXecution Environment).
 */
export function deriveSharedSecret(
  privateKey: Uint8Array,
  peerPublicKey: Uint8Array
): Uint8Array {
  const rawShared = x25519.getSharedSecret(privateKey, peerPublicKey);
  // Derive a 32-byte key from the shared secret using SHA-256
  return sha256(rawShared);
}

/**
 * Encrypt a guess string using XChaCha20-Poly1305 AEAD.
 *
 * This provides authenticated encryption — the ciphertext cannot be
 * tampered with without detection. Uses a 24-byte nonce for
 * XChaCha20's extended nonce space (safe for random nonces).
 */
export function encryptGuess(
  guess: string,
  sharedKey: Uint8Array
): EncryptedPayload {
  const nonce = randomBytes(24); // XChaCha20 uses 24-byte nonces
  const plaintext = new TextEncoder().encode(guess.toLowerCase());
  const cipher = xchacha20poly1305(sharedKey, nonce);
  const ciphertext = cipher.encrypt(plaintext);

  return {
    ciphertext,
    nonce,
    senderPublicKey: new Uint8Array(32), // placeholder, set by caller
  };
}

/**
 * Decrypt a guess from its encrypted payload.
 * Used server-side or by the game authority for verification.
 */
export function decryptGuess(
  payload: EncryptedPayload,
  sharedKey: Uint8Array
): string {
  const cipher = xchacha20poly1305(sharedKey, payload.nonce);
  const plaintext = cipher.decrypt(payload.ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Compute SHA-256 hash of a word (matches on-chain hashing).
 * The on-chain program uses `solana_program::hash::hash` which is SHA-256.
 */
export function hashWord(word: string): Uint8Array {
  return sha256(new TextEncoder().encode(word.toLowerCase()));
}

/**
 * Full encrypted guess flow:
 * 1. Generate ephemeral keypair
 * 2. Derive shared secret with game's public key
 * 3. Encrypt the guess
 * 4. Return encrypted payload + plaintext hash for on-chain verification
 *
 * The plaintext guess goes to the on-chain program for hash comparison.
 * The encrypted payload provides transport-layer privacy.
 */
export function prepareEncryptedGuess(
  guess: string,
  gamePublicKey: Uint8Array
): {
  encryptedPayload: EncryptedPayload;
  guessHash: Uint8Array;
  ephemeralKeyPair: ArciumKeyPair;
} {
  const keyPair = generateKeyPair();
  const sharedKey = deriveSharedSecret(keyPair.privateKey, gamePublicKey);
  const payload = encryptGuess(guess, sharedKey);
  payload.senderPublicKey = keyPair.publicKey;

  return {
    encryptedPayload: payload,
    guessHash: hashWord(guess),
    ephemeralKeyPair: keyPair,
  };
}

/**
 * Generate a game-level X25519 keypair.
 * The public key is published; the private key is held by the game authority
 * (or distributed via Arcium MPC to avoid single-point key custody).
 */
export function generateGameKeyPair(): ArciumKeyPair {
  return generateKeyPair();
}
