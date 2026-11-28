import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { LiveblocksError, type Liveblocks, type RoomData } from "@liveblocks/node";

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

function isConflict(error: unknown): boolean {
  return error instanceof LiveblocksError && error.status === 409;
}

/**
 * Creates a room no client can enter (`defaultAccesses: []`) under a fresh
 * random code, and returns the code, or `null` if three codes in a row were
 * taken. A collision among ~8e14 codes is practically impossible, but
 * retrying costs nothing and keeps creation from ever failing on one. The
 * server picks the code, so a client can't choose a guessable one.
 */
export async function createLockedRoom(
  liveblocks: Liveblocks,
  roomIdForCode: (code: string) => string,
  metadata: Record<string, string>,
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateEventCode();
    try {
      await liveblocks.createRoom(roomIdForCode(code), { defaultAccesses: [], metadata });
      return code;
    } catch (error) {
      if (!isConflict(error)) throw error;
    }
  }
  return null;
}

/** Outcome of {@link verifyEventEditKey}. */
export type EditKeyCheck = "ok" | "not-found" | "forbidden";

/** The room when it exists and its metadata says it's a `kind` room; `null` otherwise. */
export async function getRoomOfKind(
  liveblocks: Liveblocks,
  roomId: string,
  kind: string,
): Promise<RoomData | null> {
  try {
    const room = await liveblocks.getRoom(roomId);
    return room.metadata.kind === kind ? room : null;
  } catch (error) {
    if (isRoomNotFound(error)) return null;
    throw error;
  }
}

/** Checks an edit key against an event room's stored hash. */
export async function verifyEventEditKey(
  liveblocks: Liveblocks,
  code: string,
  editKey: string,
): Promise<EditKeyCheck> {
  const room = await getRoomOfKind(liveblocks, eventRoomIdForCode(code), "event");
  if (!room) return "not-found";
  return secretKeyMatches(editKey, room.metadata.editKeyHash) ? "ok" : "forbidden";
}
