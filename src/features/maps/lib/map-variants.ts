import type { CustomMapEntry } from "../types";
import type { MapVariant } from "./map-config";

/**
 * Merges a map's static config variants with any resolved custom-upload
 * variants - the merge `map-config.ts`'s own doc comment already promised
 * ("custom variants are merged in at the store/selector level") but that,
 * confirmed via direct research, never actually existed until this step. A
 * custom entry whose image hasn't resolved from IndexedDB into `imageCache`
 * yet (see `hooks/use-map-variants.ts`) is simply omitted - it appears once
 * resolved rather than rendering a broken/loading tab, keeping this
 * function pure and `MapImageryLayer` fully synchronous (per the Phase 5
 * step 12 plan's decision #1).
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
