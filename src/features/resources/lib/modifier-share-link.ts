import { useMemo, useSyncExternalStore } from "react";

/**
 * Share links for modifier picks, as short as a link can be: the picks ride
 * in the URL fragment as a bitmask, one bit per slot in the season's
 * append-only slot list, base64url-encoded (`#s=2&p=AAAAEAAAIA`). Every pick
 * at once is 10 characters. Nothing is stored server side and the fragment
 * never reaches the server. The season number is part of the link so a link
 * from another season is recognized instead of being read against the
 * wrong list. Pick order isn't kept: picks come back in slot order, which
 * nothing on the page depends on.
 *
 * Opening a link shows its picks as a separate shared view: editing it
 * rewrites the fragment, never the reader's own saved picks, until they
 * choose to save it (see `SeasonalModifierPlanner`).
 */

/** The longest fragment read, so a pasted giant link can't stall the page. A real one is under 30 characters. */
export const MAX_SHARE_HASH_LENGTH = 200;

/**
 * How one season's links are written: its number, and its slot list
 * (append only, `null` for a retired modifier; see `MODIFIER_SHARE_SLOTS`).
 */
export interface ShareScheme {
  season: number;
  slots: readonly (string | null)[];
}

/**
 * What a URL fragment holds: no share link, a link's picks, a link from
 * another season, or a link that's cut off, garbled or too long to read.
 */
export type SharedPicks =
  | { status: "none" }
  | { status: "picks"; ids: readonly string[] }
  | { status: "other-season" }
  | { status: "invalid" };

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes a bitmask code, or `null` unless it's exactly what
 * {@link picksHash} writes: valid base64url with no leftover bits and no
 * trailing zero byte. That catches most cut-off codes, which would
 * otherwise open quietly with some picks missing. The round trip also
 * rejects any character outside base64url, and `atob` takes the code
 * unpadded.
 */
function decodeCode(code: string): Uint8Array | null {
  let bytes: Uint8Array;
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
  if (bytes.at(-1) === 0 || toBase64Url(bytes) !== code) return null;
  return bytes;
}

/** The fragment for a link to `ids`. Ids without a slot are left out. */
export function picksHash(scheme: ShareScheme, ids: readonly string[]): string {
  const picked = new Set(ids);
  const bytes = new Uint8Array(Math.ceil(scheme.slots.length / 8));
  scheme.slots.forEach((id, slot) => {
    if (id === null || !picked.has(id)) return;
    const index = Math.floor(slot / 8);
    bytes[index] = (bytes[index] ?? 0) | (1 << (slot % 8));
  });
  // Trailing empty bytes say nothing, so they're dropped.
  const used = bytes.subarray(0, bytes.findLastIndex((byte) => byte !== 0) + 1);
  return `#s=${String(scheme.season)}&p=${toBase64Url(used)}`;
}

/** Reads a fragment from {@link picksHash}. Bits for retired slots, or past the last slot, are ignored. */
export function picksFromHash(hash: string, scheme: ShareScheme): SharedPicks {
  // Not parsed at all past the cap, so a giant fragment costs nothing.
  if (hash.length > MAX_SHARE_HASH_LENGTH) return { status: "invalid" };
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const code = params.get("p");
  if (code === null) return { status: "none" };
  const season = params.get("s");
  if (season === null) return { status: "invalid" };
  if (season !== String(scheme.season)) return { status: "other-season" };
  const bytes = decodeCode(code);
  if (!bytes) return { status: "invalid" };
  const ids = scheme.slots.filter(
    (id, slot): id is string =>
      id !== null && ((bytes[Math.floor(slot / 8)] ?? 0) & (1 << (slot % 8))) !== 0,
  );
  return { status: "picks", ids };
}

/**
 * The fragment as an external store: `hashchange` covers links pasted into
 * the address bar, and {@link replaceHash} notifies for the writes below,
 * which `history.replaceState` makes without firing that event.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

/** Swaps only the fragment; the rest of the current address is left as it is. */
function replaceHash(hash: string): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}${hash}`);
  for (const listener of listeners) listener();
}

/** The picks in the current URL fragment. Empty on the server, so the first render matches. */
export function useSharedPicks(scheme: ShareScheme): SharedPicks {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  return useMemo(() => picksFromHash(hash, scheme), [hash, scheme]);
}

/** Rewrites the shared picks in the fragment, without adding a history entry. */
export function setSharedPicks(scheme: ShareScheme, ids: readonly string[]): void {
  replaceHash(picksHash(scheme, ids));
}

/** Drops the shared picks from the fragment, back to the reader's own picks. */
export function leaveSharedView(): void {
  replaceHash("");
}
