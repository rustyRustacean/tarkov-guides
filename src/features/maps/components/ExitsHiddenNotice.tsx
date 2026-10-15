"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";

import { useExitSnipStore } from "../exit-snip-store";
import {
  getMapConfig,
  markerVariantId,
  resolveVariantId,
  variantHasAccurateMarkers,
} from "../lib/map-config";
import { tabForRaidLocation } from "../lib/raid-location";
import { useMapsStore } from "../store";

interface Props {
  normalizedName: string;
}

/**
 * "The exits you snipped are for THIS map, but this view can't draw them -
 * one click fixes that."
 *
 * Same job as `PositionHiddenNotice`, for the same reason: markers are only
 * drawn on variants that project accurately (`variantHasAccurateMarkers`), so
 * on a 2D/3D image a freshly applied exit list would silently show nothing.
 * Renders nothing unless exits were applied for this map AND the current view
 * can't show them.
 */
export function ExitsHiddenNotice({ normalizedName }: Props) {
  const snip = useExitSnipStore((state) => state.snip);
  const { data } = useTarkovGameData();
  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);

  if (snip === null) return null;
  if (tabForRaidLocation(snip.nameId, data?.maps ?? []) !== normalizedName) return null;

  const config = getMapConfig(normalizedName);
  if (!config) return null;
  const variant = config.variants.find(
    (v) => v.id === resolveVariantId(config.variants, storedVariantId ?? null),
  );
  if (!variant || variantHasAccurateMarkers(variant)) return null;

  const target = markerVariantId(config.variants);
  if (!target) return null;
  const targetLabel = config.variants.find((v) => v.id === target)?.label ?? target;

  return (
    <div className="bg-background/95 border-border pointer-events-auto flex items-center gap-3 rounded-md border px-3 py-2 shadow-md backdrop-blur-sm">
      <span className="text-sm">
        Your exit list is on this map, but this view can&apos;t place the exits.
      </span>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setMapVariant(normalizedName, target);
        }}
      >
        Show exits on {targetLabel}
      </Button>
    </div>
  );
}
