import { useMemo, useSyncExternalStore } from "react";

import { keepValidIds } from "./modifier-picks-storage";

/**
 * Share links for modifier picks. The picks ride in the URL fragment as
 * readable ids (`#season=untar-control&picks=average,no-flea-market`), so
 * nothing is stored server side, the fragment never reaches the server, and
 * a link keeps working if modifiers are reordered. The season is part of
 * the link so a link from another season is recognized instead of being
 * read against the wrong list.
 *
 * Opening a link shows its picks as a separate shared view: editing it
 * rewrites the fragment, never the reader's own saved picks, until they
 * choose to save it (see `SeasonalModifierPlanner`).
 */

/** The longest fragment read, so a pasted giant link can't stall the page. Every pick fits in well under 1,000 characters. */
export const MAX_SHARE_HASH_LENGTH = 4000;

/**
 * What a URL fragment holds: no share link, a link's picks, a link from
 * another season, or a link that's cut off or too long to read.
 */
export type SharedPicks =
  | { status: "none" }
  | { status: "picks"; ids: readonly string[] }
  | { status: "other-season" }
  | { status: "invalid" };

/** The fragment for a link to `ids`, in pick order. */
export function picksHash(seasonId: string, ids: readonly string[]): string {
  return `#season=${encodeURIComponent(seasonId)}&picks=${ids.map(encodeURIComponent).join(",")}`;
}

/** Reads a fragment from {@link picksHash}, keeping only ids in `validIds`, each once. */
export function picksFromHash(
  hash: string,
  seasonId: string,
  validIds: ReadonlySet<string>,
): SharedPicks {
  // Not parsed at all past the cap, so a giant fragment costs nothing.
  if (hash.length > MAX_SHARE_HASH_LENGTH) return { status: "invalid" };
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const picks = params.get("picks");
  if (picks === null) return { status: "none" };
  const season = params.get("season");
  if (season === null) return { status: "invalid" };
  if (season !== seasonId) return { status: "other-season" };
  return { status: "picks", ids: keepValidIds(picks.split(","), validIds) };
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
export function useSharedPicks(seasonId: string, validIds: ReadonlySet<string>): SharedPicks {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  return useMemo(() => picksFromHash(hash, seasonId, validIds), [hash, seasonId, validIds]);
}

/** Rewrites the shared picks in the fragment, without adding a history entry. */
export function setSharedPicks(seasonId: string, ids: readonly string[]): void {
  replaceHash(picksHash(seasonId, ids));
}

/** Drops the shared picks from the fragment, back to the reader's own picks. */
export function leaveSharedView(): void {
  replaceHash("");
}
