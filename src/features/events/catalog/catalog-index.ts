import type { CatalogCategory, CatalogItem, ItemCatalog } from "./catalog-types";

/** Lookups over an {@link ItemCatalog}, built once per catalog (never persisted: `Map`s don't survive the query cache's JSON). */
export interface CatalogIndex {
  categoriesById: ReadonlyMap<string, CatalogCategory>;
  /** Child categories by parent id (`""` for the roots), in catalog order. */
  childrenOf: ReadonlyMap<string, readonly CatalogCategory[]>;
  item: (itemId: string) => CatalogItem | undefined;
  /** An item's categories, most specific first, ending at its root. Empty for items the catalog doesn't cover. */
  categoriesOfItem: (itemId: string) => readonly string[];
  /** Depth of a category: roots are 0. */
  depth: (categoryId: string) => number;
  /** A category and every category under it. */
  descendantsOf: (categoryId: string) => ReadonlySet<string>;
  /** The category with this slug (e.g. `bolt-action-rifles`), if the catalog has it. */
  idForSlug: (slug: string) => string | undefined;
}

/** Builds the lookups. */
export function buildCatalogIndex(catalog: ItemCatalog): CatalogIndex {
  const categoriesById = new Map(catalog.categories.map((category) => [category.id, category]));
  const childrenOf = new Map<string, CatalogCategory[]>();
  for (const category of catalog.categories) {
    const key = category.parent && categoriesById.has(category.parent) ? category.parent : "";
    const list = childrenOf.get(key);
    if (list) list.push(category);
    else childrenOf.set(key, [category]);
  }

  const chainCache = new Map<string, readonly string[]>();
  const chain = (categoryId: string): readonly string[] => {
    const cached = chainCache.get(categoryId);
    if (cached) return cached;
    const out: string[] = [];
    let current = categoriesById.get(categoryId);
    while (current && !out.includes(current.id)) {
      out.push(current.id);
      current = current.parent ? categoriesById.get(current.parent) : undefined;
    }
    chainCache.set(categoryId, out);
    return out;
  };

  const descendantCache = new Map<string, ReadonlySet<string>>();
  const descendantsOf = (categoryId: string): ReadonlySet<string> => {
    const cached = descendantCache.get(categoryId);
    if (cached) return cached;
    const out = new Set<string>([categoryId]);
    const queue = [categoryId];
    while (queue.length > 0) {
      const next = queue.pop();
      for (const child of next === undefined ? [] : (childrenOf.get(next) ?? [])) {
        if (!out.has(child.id)) {
          out.add(child.id);
          queue.push(child.id);
        }
      }
    }
    descendantCache.set(categoryId, out);
    return out;
  };

  const idsBySlug = new Map(catalog.categories.map((category) => [category.slug, category.id]));

  return {
    categoriesById,
    childrenOf,
    item: (itemId) => catalog.items[itemId],
    categoriesOfItem: (itemId) => {
      const record = catalog.items[itemId];
      return record ? chain(record.c) : [];
    },
    depth: (categoryId) => Math.max(chain(categoryId).length - 1, 0),
    descendantsOf,
    idForSlug: (slug) => idsBySlug.get(slug),
  };
}
