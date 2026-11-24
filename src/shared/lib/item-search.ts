import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";

/** Options for {@link searchItems}. */
export interface ItemSearchOptions {
  /** The most results to return. */
  limit?: number;
  /** Skips any item this returns `false` for, before matching. */
  accept?: (item: NormalizedItem) => boolean;
}

/**
 * Items whose name or short name match `query` (case-insensitive), prefix
 * matches first, then any other match, each in data order. An empty query
 * returns nothing, so a search box shows no list until someone types.
 */
export function searchItems(
  items: readonly NormalizedItem[],
  query: string,
  { limit = 8, accept }: ItemSearchOptions = {},
): readonly NormalizedItem[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const starts: NormalizedItem[] = [];
  const contains: NormalizedItem[] = [];
  for (const item of items) {
    if (accept && !accept(item)) continue;
    const name = item.name.toLowerCase();
    const short = item.shortName.toLowerCase();
    if (name.startsWith(term) || short.startsWith(term)) starts.push(item);
    else if (name.includes(term) || short.includes(term)) contains.push(item);
    // Enough best-kind matches: nothing later can outrank them.
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
