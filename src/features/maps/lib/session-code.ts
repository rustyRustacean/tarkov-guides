/**
 * Join-code generation/validation for collaborative map sessions
 * (`features/maps/session/`). The normalized code IS the Liveblocks room id
 * (see `liveblocks-config.ts`'s `roomIdForCode`) - there's no database to map
 * a separate code to a room, so "is this code taken" is answered by asking
 * Liveblocks whether that room exists, never by a client-side check here.
 */

const ADJECTIVES: readonly string[] = [
  "silent",
  "swift",
  "hidden",
  "lucky",
  "quiet",
  "rusty",
  "shadow",
  "bold",
  "grim",
  "sneaky",
  "sharp",
  "steady",
  "wild",
  "lone",
  "clever",
  "brave",
  "iron",
  "quick",
  "frost",
  "night",
];

const NOUNS: readonly string[] = [
  "scav",
  "raider",
  "sniper",
  "medic",
  "trader",
  "hunter",
  "ghost",
  "wolf",
  "hawk",
  "raven",
  "viper",
  "rogue",
  "runner",
  "scout",
  "guard",
  "reaper",
  "phantom",
  "ranger",
  "cobra",
  "falcon",
];

export const SESSION_CODE_MIN_LENGTH = 6;
export const SESSION_CODE_MAX_LENGTH = 32;

/** A small denylist of trivially-guessable custom words - not exhaustive, just filters the obvious ones a stranger would try first. */
const DENYLIST = new Set([
  "test",
  "admin",
  "raid",
  "party",
  "session",
  "default",
  "tarkov",
  "guide",
]);

/**
 * Collapses free-typed input into the `[a-z0-9-]` charset this feature's
 * codes/room ids use: lowercased, trimmed, internal whitespace runs become a
 * single hyphen, and any remaining disallowed character is dropped. Used
 * right before deriving a Liveblocks room id from a code a user typed or
 * pasted (e.g. from an invite link) - NOT used to "fix up" a custom code at
 * creation time, where {@link isValidCustomCode} instead rejects bad input
 * outright so the host gets real feedback rather than a silently mutated code.
 */
export function normalizeSessionCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * The Liveblocks room id backing a given join code - a `"maps:"`-prefixed,
 * normalized code, since there's no database to hold a separate code -> room
 * id mapping. This means checking whether a code is taken *is* checking
 * whether this room already exists (see `api/maps-session/token/route.ts`) -
 * there's no separate lookup table to keep in sync.
 */
export function roomIdForCode(code: string): string {
  return `maps:${normalizeSessionCode(code)}`;
}

/**
 * Two random words plus a 2-digit suffix (e.g. `silent-scav-42`) - memorable
 * and easy to read aloud, unlike a random alphanumeric string. Purely
 * client-side and free to call repeatedly (e.g. a "Regenerate" button) since
 * it never touches the network - collision-checking only happens server-side,
 * as a side effect of the real `POST /api/maps-session/token` host attempt.
 */
export function generateSessionCode(): string {
  // The `??` fallbacks are unreachable (both arrays are non-empty constants
  // above) - `noUncheckedIndexedAccess` can't see that, so this just
  // satisfies the type checker without a non-null assertion.
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] ?? "silent";
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)] ?? "scav";
  const suffix = 10 + Math.floor(Math.random() * 90);
  return `${adjective}-${noun}-${String(suffix)}`;
}

export interface CustomCodeValidation {
  valid: boolean;
  /** Present only when `valid` is `false` - a short, user-facing reason. */
  reason?: string;
}

/**
 * Validates a host-chosen custom join word/phrase. Deliberately does not
 * normalize-then-accept - unlike {@link normalizeSessionCode}, this rejects
 * disallowed input outright (wrong length, bad characters, denylisted, purely
 * numeric) so the host gets immediate, honest feedback instead of a silently
 * altered code. Entirely client-side; uniqueness against other active
 * sessions is checked server-side only (see `api/maps-session/token/route.ts`).
 */
export function isValidCustomCode(input: string): CustomCodeValidation {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length < SESSION_CODE_MIN_LENGTH) {
    return {
      valid: false,
      reason: `Must be at least ${String(SESSION_CODE_MIN_LENGTH)} characters.`,
    };
  }
  if (trimmed.length > SESSION_CODE_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Must be at most ${String(SESSION_CODE_MAX_LENGTH)} characters.`,
    };
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return { valid: false, reason: "Only lowercase letters, numbers, and hyphens are allowed." };
  }
  if (!/[a-z]/.test(trimmed)) {
    return { valid: false, reason: "Must include at least one letter." };
  }
  if (DENYLIST.has(trimmed)) {
    return {
      valid: false,
      reason: "That word is too common - please choose something more unique.",
    };
  }

  return { valid: true };
}
