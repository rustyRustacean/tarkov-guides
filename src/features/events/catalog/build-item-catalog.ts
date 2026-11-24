import {
  SYNTHETIC_CATEGORIES,
  type CatalogCategory,
  type CatalogItem,
  type ItemCatalog,
} from "./catalog-types";

/** The slice of tarkov.dev's `items` resource the catalog reads. */
export interface CatalogSourceData {
  items: Record<string, CatalogSourceItem>;
  handbookCategories: Record<string, CatalogSourceCategory>;
  itemCategories?: Record<string, { normalizedName?: string }>;
}

/** One item, as far as the catalog cares. */
export interface CatalogSourceItem {
  id: string;
  types?: readonly string[];
  /** Most specific first, then its ancestors. */
  handbookCategories?: readonly string[];
  /** BSG's own category ids, most specific first. */
  categories?: readonly string[];
  properties?: Record<string, unknown> | null;
}

/** One handbook category. */
export interface CatalogSourceCategory {
  id: string;
  name: string;
  normalizedName: string;
  imageLink?: string | null;
  parent?: string | null;
}

/** Handbook roots worth restricting in a preset. Keys, info items, maps, money and the like are left out. */
const INCLUDED_ROOTS: ReadonlySet<string> = new Set([
  "weapons",
  "weapon-parts-mods",
  "gear",
  "ammo",
  "medication",
  "provisions",
  "special-equipment",
  "barter-items",
]);

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Builds the catalog from tarkov.dev's items resource. Pure, so the route
 * stays thin and this stays testable.
 *
 * Armored rigs are tactical rigs with an armor class or plate slots: only
 * 23 of 59 carry tarkov.dev's `armor` tag (plate carriers like the AVS
 * don't), so the tag alone would miss most of them (measured 2026-11-22).
 */
export function buildItemCatalog(source: CatalogSourceData): ItemCatalog {
  const handbook = source.handbookCategories;
  const bySlug = new Map(
    Object.values(handbook).map((category) => [category.normalizedName, category]),
  );

  const rootSlugOf = new Map<string, string>();
  const rootOf = (id: string): string => {
    const known = rootSlugOf.get(id);
    if (known !== undefined) return known;
    let current = handbook[id];
    const seen = new Set<string>();
    while (current?.parent && handbook[current.parent] && !seen.has(current.id)) {
      seen.add(current.id);
      current = handbook[current.parent];
    }
    const slug = current?.normalizedName ?? "";
    rootSlugOf.set(id, slug);
    return slug;
  };

  const categories: CatalogCategory[] = [];
  for (const category of Object.values(handbook)) {
    if (!INCLUDED_ROOTS.has(rootOf(category.id))) continue;
    categories.push({
      id: category.id,
      name: category.name,
      slug: category.normalizedName,
      parent: category.parent && handbook[category.parent] ? category.parent : null,
      icon: category.imageLink ?? null,
    });
  }
  const syntheticParent = new Map<string, string>();
  for (const synthetic of Object.values(SYNTHETIC_CATEGORIES)) {
    const parent = bySlug.get(synthetic.parentSlug);
    if (!parent) continue;
    syntheticParent.set(synthetic.id, parent.id);
    categories.push({
      id: synthetic.id,
      name: synthetic.name,
      slug: synthetic.id,
      parent: parent.id,
      icon: parent.imageLink ?? null,
      synthetic: true,
    });
  }

  const bsgSlug = (id: string | undefined) =>
    id ? (source.itemCategories?.[id]?.normalizedName ?? "") : "";
  const leafSlug = (id: string) => handbook[id]?.normalizedName;
  const items: Record<string, CatalogItem> = {};
  for (const item of Object.values(source.items)) {
    if (item.types?.includes("preset")) continue;
    const leaf = item.handbookCategories?.[0];
    if (!leaf || !handbook[leaf] || !INCLUDED_ROOTS.has(rootOf(leaf))) continue;

    const properties = item.properties ?? {};
    const armorClass = finiteNumber(properties.class);
    const plateSlots = Array.isArray(properties.armorSlots) ? properties.armorSlots.length : 0;
    let category = leaf;
    switch (leafSlug(leaf)) {
      case "tactical-rigs":
        category =
          (armorClass ?? 0) > 0 || plateSlots > 0 || item.types?.includes("armor")
            ? SYNTHETIC_CATEGORIES.armoredRigs.id
            : SYNTHETIC_CATEGORIES.unarmoredRigs.id;
        break;
      case "headgear":
        category =
          properties.propertiesType === "ItemPropertiesHelmet" || (armorClass ?? 0) > 0
            ? SYNTHETIC_CATEGORIES.helmets.id
            : SYNTHETIC_CATEGORIES.otherHeadwear.id;
        break;
      case "gear-components":
        if (bsgSlug(item.categories?.[0]) === "armor-plate") {
          category = SYNTHETIC_CATEGORIES.armorPlates.id;
        }
        break;
      default:
        break;
    }
    if (category !== leaf && !syntheticParent.has(category)) category = leaf;

    const record: CatalogItem = { c: category };
    if (armorClass !== undefined && armorClass > 0) record.ac = armorClass;
    const pen = finiteNumber(properties.penetrationPower);
    if (pen !== undefined) {
      record.pen = pen;
      const damage = finiteNumber(properties.damage);
      if (damage !== undefined) record.dmg = damage;
    }
    items[item.id] = record;
  }

  return { version: 1, categories, items };
}
