"use client";

import { useCallback } from "react";

import {
  getMapConfig,
  markerVariantId,
  resolveVariantId,
  variantHasAccurateMarkers,
} from "../lib/map-config";
import { useMapsStore } from "../store";

/**
 * Flags, paths and the ruler are markers, and markers are only drawn on views
 * that place them accurately (not an uncalibrated 2D/3D image, which several
 * maps open on). Turning one of these tools on is a clear "show me", so the
 * returned function moves the view to one that can draw them instead of
 * silently showing nothing.
 */
export function useEnsureMarkerView(normalizedName: string): () => void {
  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);
  return useCallback(() => {
    const config = getMapConfig(normalizedName);
    if (!config) return;
    const current = config.variants.find(
      (variant) => variant.id === resolveVariantId(config.variants, storedVariantId ?? null),
    );
    if (current && variantHasAccurateMarkers(current)) return;
    const target = markerVariantId(config.variants);
    if (target) setMapVariant(normalizedName, target);
  }, [normalizedName, storedVariantId, setMapVariant]);
}
