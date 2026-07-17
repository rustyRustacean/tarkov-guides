import type { ResolvableGameItem } from "./resolve-game-item";

/**
 * One curated "where to find this item" entry, reshaped from
 * `old/TarkovTrackerWB-main/src/data/itemLocations.js`'s flat
 * `{_match, _general, customs, reserve, ...}` object (the underscore
 * prefixes there are a workaround for that file having no type system -
 * a flat TS index signature would have to be `string | string[]`-typed
 * and lose per-map-key precision). Content is ported verbatim; only the
 * container shape changes.
 */
export interface ItemLocationEntry {
  /** Substrings matched against a live item's lowercased `name` when the shortName-key lookup misses. */
  readonly match: readonly string[];
  /** Fallback hint shown when no specific map is active. */
  readonly general: string;
  /** Map `normalizedName` → free-text "where to find" hint. Only maps with curated hints have a key here. */
  readonly perMap: Readonly<Record<string, string>>;
}

export interface ItemLocationLookupResult {
  key: string;
  entry: ItemLocationEntry;
}

/**
 * Resolves a live item to its curated location-hint entry. Ported from
 * `itemLocations.js`'s `getItemLocations`: shortName-key lookup first
 * (fast path), then substring-match the item's `name` against every
 * entry's `match` array as a fallback (catches items whose tarkov.dev
 * shortName doesn't line up with the curated key).
 */
export function findItemLocationEntry(
  item: ResolvableGameItem,
  locations: Readonly<Record<string, ItemLocationEntry>>,
): ItemLocationLookupResult | undefined {
  const shortKey = item.shortName.toLowerCase();
  const byShortName = shortKey ? locations[shortKey] : undefined;
  if (byShortName) return { key: shortKey, entry: byShortName };

  const name = item.name.toLowerCase();
  for (const [key, entry] of Object.entries(locations)) {
    if (entry.match.some((needle) => name.includes(needle))) {
      return { key, entry };
    }
  }
  return undefined;
}
