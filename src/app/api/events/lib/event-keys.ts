import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { LiveblocksError, type Liveblocks } from "@liveblocks/node";

import {
  EVENT_CODE_ALPHABET,
  EVENT_CODE_LENGTH,
  eventRoomIdForCode,
} from "@/features/events/lib/event-code";

/** A fresh, uniformly random event code. */
export function generateEventCode(): string {
  let code = "";
  for (let i = 0; i < EVENT_CODE_LENGTH; i++) {
    code += EVENT_CODE_ALPHABET[randomInt(EVENT_CODE_ALPHABET.length)] ?? "";
  }
  return code;
}

/** A fresh edit (or manage) key: 32 random bytes, base64url. */
export function generateSecretKey(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * What room metadata stores in place of the key. A plain SHA-256 is enough
 * (no salt or slow hash): the key is 256 random bits, not a password, so
 * there's nothing to brute-force from the hash.
 */
export function hashSecretKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Compares a key against a stored hash in constant time. */
export function secretKeyMatches(key: string, storedHash: unknown): boolean {
  if (typeof storedHash !== "string" || storedHash.length !== 64) return false;
  const actual = Buffer.from(hashSecretKey(key), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when a Liveblocks call failed because the room doesn't exist. */
export function isRoomNotFound(error: unknown): boolean {
  return error instanceof LiveblocksError && error.status === 404;
}

/** Outcome of {@link verifyEventEditKey}. */
export type EditKeyCheck = "ok" | "not-found" | "forbidden";

/** Checks an edit key against an event room's stored hash. */
export async function verifyEventEditKey(
  liveblocks: Liveblocks,
  code: string,
  editKey: string,
): Promise<EditKeyCheck> {
  try {
    const room = await liveblocks.getRoom(eventRoomIdForCode(code));
    if (room.metadata.kind !== "event") return "not-found";
    return secretKeyMatches(editKey, room.metadata.editKeyHash) ? "ok" : "forbidden";
  } catch (error) {
    if (isRoomNotFound(error)) return "not-found";
    throw error;
  }
}
