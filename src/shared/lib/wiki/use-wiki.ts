"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchWikiGuideData, type WikiGuideData } from "./fetch-wiki";

/** Cached wiki guide text + screenshot gallery for a slug. Disabled (never fetches) when `slug` is null. One request/parse per slug (react-query dedupes/caches), not one each for text and images; see `fetchWikiGuideData`'s doc comment. */
export function useWikiGuideData(slug: string | null) {
  return useQuery<WikiGuideData>({
    queryKey: ["wiki-guide-data", slug],
    queryFn: () => fetchWikiGuideData(slug ?? ""),
    enabled: slug !== null && slug.length > 0,
    staleTime: Infinity,
  });
}
