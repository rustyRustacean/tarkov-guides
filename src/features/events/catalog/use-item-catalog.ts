"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildCatalogIndex, type CatalogIndex } from "./catalog-index";

import type { ItemCatalog } from "./catalog-types";

/** Bump when {@link ItemCatalog}'s shape changes, so a persisted older copy is refetched rather than misread. */
const CATALOG_QUERY_VERSION = 1;

async function fetchItemCatalog(signal: AbortSignal): Promise<ItemCatalog> {
  const response = await fetch("/api/item-catalog", { signal });
  if (!response.ok) throw new Error("Item catalog unavailable");
  const body = (await response.json()) as Partial<Record<keyof ItemCatalog, unknown>>;
  if (body.version !== 1 || !Array.isArray(body.categories) || typeof body.items !== "object") {
    throw new Error("Unexpected item catalog");
  }
  return body as ItemCatalog;
}

/**
 * The preset item catalog and its lookups. Persisted with the rest of the
 * query cache (it changes with game patches, not minute to minute), and
 * refetched after 12 hours like the main dataset.
 */
export function useItemCatalog(): {
  index: CatalogIndex | null;
  isPending: boolean;
  isError: boolean;
} {
  const { data, isPending, isError } = useQuery({
    queryKey: ["item-catalog", CATALOG_QUERY_VERSION],
    queryFn: ({ signal }) => fetchItemCatalog(signal),
    staleTime: 12 * 60 * 60 * 1000,
  });
  const index = useMemo(() => (data ? buildCatalogIndex(data) : null), [data]);
  return { index, isPending, isError };
}
