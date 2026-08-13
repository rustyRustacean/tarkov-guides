/** The minimal shape any live game item needs for curated-data resolution. */
export interface ResolvableGameItem {
  readonly shortName: string;
  readonly name: string;
}

/**
 * A hand-authored reference to a live item, as found in curated datasets
 * like `beginnerItems.js`/`itemLocations.js`: neither of which stores a
 * tarkov.dev item id directly (see `src/shared/data/README.md` for why).
 */
export interface ItemResolutionSpec {
  /** Matched against a live item's lowercased `shortName` (fast path). */
  short?: string;
  /** Matched against a live item's lowercased `name` as a fallback when `short` misses. */
  nameLike?: string;
  /** When true, `nameLike` must equal the item's name exactly rather than just being a substring. */
  nameExact?: boolean;
}

/**
 * Resolves a curated `{short, nameLike}` reference to a live item. Ported
 * from `old/TarkovTrackerWB-main/src/data/itemLocations.js`'s
 * `resolveCurated` (confirmed to be the same two-tier algorithm
 * `kappa.js`'s `renderBeginner()` duplicates inline for beginner items):
 * shortName-key lookup first, then a `nameLike` fallback against every
 * item's `name` (substring by default, exact match when `nameExact` is
 * set). Returns `undefined` on a total miss rather than throwing:
 * legacy's own header comment documents this as deliberate resilience to
 * tarkov.dev renaming/removing items over time, not an oversight.
 */
export function resolveGameItem<TItem extends ResolvableGameItem>(
  items: readonly TItem[],
  byShortName: Readonly<Record<string, TItem>>,
  spec: ItemResolutionSpec,
): TItem | undefined {
  const shortKey = spec.short?.toLowerCase();
  if (shortKey) {
    const bySort = byShortName[shortKey];
    if (bySort) return bySort;
  }

  const nameKey = spec.nameLike?.toLowerCase();
  if (!nameKey) return undefined;

  return spec.nameExact
    ? items.find((item) => item.name.toLowerCase() === nameKey)
    : items.find((item) => item.name.toLowerCase().includes(nameKey));
}

/**
 * Resolves a batch of curated specs (e.g. one beginner-items category),
 * dropping any that don't resolve to a live item. In development, logs a
 * single `console.warn` listing the unresolved specs so a broken curated
 * entry is easy to spot during migration/QA without being noisy in
 * production (mirrors the dev-only gating pattern used elsewhere in this
 * codebase, e.g. `fetch-tarkov-data.ts`'s partial-GraphQL-errors warning).
 */
export function resolveGameItems<TItem extends ResolvableGameItem>(
  specs: readonly ItemResolutionSpec[],
  items: readonly TItem[],
  byShortName: Readonly<Record<string, TItem>>,
): TItem[] {
  const resolved: TItem[] = [];
  const unresolved: ItemResolutionSpec[] = [];

  for (const spec of specs) {
    const item = resolveGameItem(items, byShortName, spec);
    if (item) {
      resolved.push(item);
    } else {
      unresolved.push(spec);
    }
  }

  if (unresolved.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn("[item-resolution] could not resolve curated entries to a live item:", unresolved);
  }

  return resolved;
}
