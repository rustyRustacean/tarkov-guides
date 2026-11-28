import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Server-side secrets: the keys this app hands out (event edit keys, preset
 * manage keys), the ones it reads from the environment (admin key, report
 * secret), and the hashes it stores in their place.
 */

/** The shortest secret accepted from the environment: about 192 bits as base64url. */
const MIN_SECRET_LENGTH = 32;

const HEX_DIGEST = /^[0-9a-f]{64}$/;

/** A fresh key to hand out (an event's edit key, a preset's manage key): 32 random bytes, base64url. */
export function generateSecretKey(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * What's stored in place of a key. A plain SHA-256 is enough (no salt or
 * slow hash): the keys are 256 random bits, not passwords, so there's
 * nothing to brute-force from the hash.
 */
export function hashSecretKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** True when `value` looks like {@link hashSecretKey}'s or {@link hmacHex}'s output: 64 hex digits. */
export function isHexDigest(value: unknown): value is string {
  return typeof value === "string" && HEX_DIGEST.test(value);
}

/**
 * Compares a key against a stored hash in constant time. To compare two
 * plain secrets (the admin key), hash the expected one first:
 * `secretKeyMatches(given, hashSecretKey(expected))`.
 */
export function secretKeyMatches(key: string, storedHash: unknown): boolean {
  if (!isHexDigest(storedHash)) return false;
  return timingSafeEqual(Buffer.from(hashSecretKey(key), "hex"), Buffer.from(storedHash, "hex"));
}

/**
 * A secret from the environment, or `null` when it's unset or too short to
 * trust. Routes that need one refuse to work without it rather than fall
 * back to something guessable.
 */
export function configuredSecret(name: string): string | null {
  const value = process.env[name];
  return typeof value === "string" && value.length >= MIN_SECRET_LENGTH ? value : null;
}

/**
 * HMAC-SHA256 of `value` under `secret`, as hex. Used to remember who
 * reported a preset without storing their IP: IPs are few enough to
 * brute-force a plain hash, but not one keyed with a secret only this
 * server holds.
 */
export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}
