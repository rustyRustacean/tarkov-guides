"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchWikiGuideText, fetchWikiImages, type WikiImage } from "./fetch-wiki";

/** Cached wiki guide text for a slug. Disabled (never fetches) when `slug` is null. */
export function useWikiGuide(slug: string | null) {
  return useQuery<string>({
    queryKey: ["wiki-guide", slug],
    queryFn: () => fetchWikiGuideText(slug ?? ""),
    enabled: slug !== null && slug.length > 0,
    staleTime: Infinity,
  });
}

/** Cached wiki screenshot gallery for a slug. Disabled (never fetches) when `slug` is null. */
export function useWikiImages(slug: string | null) {
  return useQuery<readonly WikiImage[]>({
    queryKey: ["wiki-images", slug],
    queryFn: () => fetchWikiImages(slug ?? ""),
    enabled: slug !== null && slug.length > 0,
    staleTime: Infinity,
  });
}
