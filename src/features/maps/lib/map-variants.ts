import type { CustomMapEntry } from "../types";
import type { MapVariant } from "./map-config";

/**
 * Merges a map's static config variants with any resolved custom-upload
 * variants. A custom entry whose image hasn't resolved from IndexedDB into
 * `imageCache` yet (see `hooks/use-map-variants.ts`) is simply omitted; it
 * appears once resolved rather than rendering a broken/loading tab, keeping
 * this function pure and `MapImageryLayer` fully synchronous.
 */
export function getMergedVariants(
  baseVariants: readonly MapVariant[],
  customEntries: readonly CustomMapEntry[],
  imageCache: Readonly<Record<string, string>>,
): readonly MapVariant[] {
  const customVariants: MapVariant[] = [];
  for (const entry of customEntries) {
    const imageUrl = imageCache[entry.id];
    if (imageUrl === undefined) continue;
    customVariants.push({ id: entry.id, label: entry.label, imageUrl, custom: true });
  }
  return [...baseVariants, ...customVariants];
}
