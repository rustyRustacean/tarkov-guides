import { isEditKey, isEventCode } from "./event-code";
import { hashParams } from "./share-codec";

/**
 * The public preset library: presets an owner chose to publish. Each lives
 * in its own server-only Liveblocks room, written only by the
 * `/api/event-presets` routes (no client ever gets a token for one). This
 * module is the part both sides share: ids, links and the ranking.
 */

/** Public preset ids look like event codes: 10 characters, no look-alikes. */
export const isPublicPresetId: (value: unknown) => value is string = isEventCode;

/** Manage keys look like edit keys: 32 random bytes, base64url. */
export const isManageKey: (value: unknown) => value is string = isEditKey;

/** The public library page. */
export const PUBLIC_LIBRARY_PATH = "/resources/events/presets";

/** One published preset's page. */
export function publicPresetPath(id: string): string {
  return `${PUBLIC_LIBRARY_PATH}/${id}`;
}

/**
 * The owner's manage link. The key rides in the URL fragment, which
 * browsers never send to a server, like an event's edit link.
 */
export function publicPresetManagePath(id: string, manageKey: string): string {
  return `${publicPresetPath(id)}#manage=${manageKey}`;
}

/** Reads a manage key out of a fragment like `#manage=...`, or `null`. */
export function manageKeyFromHash(hash: string): string | null {
  const key = hashParams(hash).get("manage");
  return isManageKey(key) ? key : null;
}

/** What the library list shows for a published preset. */
export interface PublicPresetSummary {
  id: string;
  name: string;
  /** Events that adopted it, each counted once. */
  uses: number;
  /** How many rules it has. */
  rules: number;
  /** Epoch ms. */
  publishedAt: number;
}

/** One collator for every comparison: `localeCompare` with options builds a new one per call. */
const byName = new Intl.Collator("en", { sensitivity: "base" });

/** Most used first, then by name (ignoring case), then by id so the order is stable. A new array. */
export function sortPublicPresets(presets: readonly PublicPresetSummary[]): PublicPresetSummary[] {
  return [...presets].sort(
    (a, b) => b.uses - a.uses || byName.compare(a.name, b.name) || (a.id < b.id ? -1 : 1),
  );
}
