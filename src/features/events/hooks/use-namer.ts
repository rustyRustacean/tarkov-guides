"use client";

import { useMemo } from "react";

import { useTarkovIndexes } from "@/shared/lib/tarkov-api/use-tarkov-indexes";

import type { CatalogIndex } from "../catalog/catalog-index";
import type { Namer } from "../lib/presets";

/** Item and category names for rule text: item names from the main dataset, category names from the catalog. */
export function useNamer(
  index: CatalogIndex | null,
): Namer & { icon: (itemId: string) => string | null } {
  const { items } = useTarkovIndexes();
  return useMemo(
    () => ({
      item: (itemId) => items.byId[itemId]?.name ?? "Unknown item",
      category: (categoryId) => index?.categoriesById.get(categoryId)?.name ?? "Unknown category",
      icon: (itemId) => items.byId[itemId]?.iconLink ?? null,
    }),
    [items, index],
  );
}
