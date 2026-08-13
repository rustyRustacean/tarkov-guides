"use client";

import { useEffect } from "react";

import { getMergedVariants } from "../lib/map-variants";
import { idbGetImage } from "../persistence/custom-map-idb";
import { useMapsStore } from "../store";

import type { MapVariant } from "../lib/map-config";
import type { CustomMapEntry } from "../types";

/** A stable empty-array reference for the `customMaps[normalizedName]` fallback, avoiding a fresh `[]` literal (and therefore an unnecessary effect re-run) on every render for any map with no custom uploads. */
const EMPTY_CUSTOM_ENTRIES: readonly CustomMapEntry[] = [];

/**
 * The merged variant list (`map-config.ts`'s static variants plus resolved
 * custom uploads): the single source both `MapVariantSwitcher` and
 * `MapViewer` read, instead of `config.variants` directly.
 *
 * Resolves any not-yet-cached custom variant's image from IndexedDB lazily,
 * once per map, rather than eagerly on app load like legacy's
 * `preloadCustomMaps()`, matching this project's "self-contained component
 * loads its own data" convention. A custom variant simply doesn't appear
 * until its image resolves (near-instant once cached, and already cached
 * immediately after upload; see `hooks/use-custom-map-upload.ts`), which is
 * what keeps `MapImageryLayer` fully synchronous.
 */
export function useMapVariants(
  normalizedName: string,
  baseVariants: readonly MapVariant[],
): readonly MapVariant[] {
  const customEntries = useMapsStore(
    (state) => state.customMaps[normalizedName] ?? EMPTY_CUSTOM_ENTRIES,
  );
  const imageCache = useMapsStore((state) => state.customMapImageCache);
  const setCustomMapImage = useMapsStore((state) => state.setCustomMapImage);

  useEffect(() => {
    for (const entry of customEntries) {
      if (imageCache[entry.id] !== undefined) continue;
      idbGetImage(entry.id)
        .then((dataUrl) => {
          if (dataUrl !== undefined) setCustomMapImage(entry.id, dataUrl);
        })
        .catch(() => {
          // Missing/corrupt IndexedDB entry: the variant just never
          // appears. No user-facing error needed since nothing was
          // actively requested by the user in this code path.
        });
    }
  }, [customEntries, imageCache, setCustomMapImage]);

  return getMergedVariants(baseVariants, customEntries, imageCache);
}
