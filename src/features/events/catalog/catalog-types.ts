/**
 * The item catalog the preset builder and kit checker run on: tarkov.dev's
 * handbook category tree (the categories players know from the in-game
 * handbook, with their icons) plus, per item, its category and the few
 * stats a preset can limit. Served by `/api/item-catalog`, separately from
 * the main game dataset: per-item categories alone are ~460 KB, and only
 * the events pages need them.
 */

/** One category, from the handbook tree or one of the splits in {@link SYNTHETIC_CATEGORIES}. */
export interface CatalogCategory {
  id: string;
  name: string;
  /** tarkov.dev's normalized name, e.g. `bolt-action-rifles`. Stable across data updates, unlike display names. */
  slug: string;
  parent: string | null;
  icon: string | null;
  /** True for categories this site adds (e.g. Armored rigs), not BSG's handbook. */
  synthetic?: true;
}

/** What the catalog knows about one item. Names and icons come from the main dataset, joined by id. */
export interface CatalogItem {
  /** The most specific category: a handbook leaf, or a synthetic split of one. */
  c: string;
  /** Armor class, for armor, armored rigs, helmets, plates and armored face and eye wear. */
  ac?: number;
  /** Ammo penetration power. */
  pen?: number;
  /** Ammo damage per projectile. */
  dmg?: number;
}

/** The whole catalog as served. */
export interface ItemCatalog {
  version: 1;
  categories: CatalogCategory[];
  items: Record<string, CatalogItem>;
}

/** A synthetic category: a split of one handbook category that BSG's tree doesn't make, but presets need. */
export interface SyntheticCategory {
  id: string;
  name: string;
  /** The handbook category (by slug) it splits. */
  parentSlug: string;
}

/**
 * Splits presets regularly need that the handbook lumps together: armored
 * vs plain rigs ("no body armor, armored rigs allowed"), helmets vs caps
 * and hats ("no helmet"), and armor plates, which the handbook files under
 * gear components with visors and mounts.
 */
export const SYNTHETIC_CATEGORIES = {
  armoredRigs: { id: "tg-armored-rigs", name: "Armored rigs", parentSlug: "tactical-rigs" },
  unarmoredRigs: { id: "tg-unarmored-rigs", name: "Unarmored rigs", parentSlug: "tactical-rigs" },
  helmets: { id: "tg-helmets", name: "Helmets", parentSlug: "headgear" },
  otherHeadwear: { id: "tg-other-headwear", name: "Other headwear", parentSlug: "headgear" },
  armorPlates: { id: "tg-armor-plates", name: "Armor plates", parentSlug: "gear-components" },
} as const satisfies Record<string, SyntheticCategory>;
