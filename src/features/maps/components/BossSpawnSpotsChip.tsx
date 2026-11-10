"use client";

import { X } from "lucide-react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { Button } from "@/shared/ui/button/Button";

import { shownBossSpawnsOn, useBossSpawnStore } from "../boss-spawn-store";
import { listNames, possessive } from "../lib/boss-spawns";
import {
  getMapConfig,
  markerVariantId,
  resolveVariantId,
  variantHasAccurateMarkers,
} from "../lib/map-config";
import { useMapsStore } from "../store";

import { BossPortrait } from "./BossStrip";

interface Props {
  normalizedName: string;
}

/**
 * Says whose possible spawn spots are on the map and clears them (×). They
 * are spots from tarkov.dev's data, never sightings, which the chip says in
 * its hover text and to screen readers, along with any of the boss's zones
 * that list no spots. The spots go on their own when the map or mode
 * changes (`useClearBossSpawnSpotsOnChange`).
 *
 * Like `ExitsHiddenNotice`: if the view is later switched to one that can't
 * place markers, the chip says so and offers a view that can, rather than
 * leaving the map silently empty.
 *
 * Always renders its live region, so the chip's arrival is announced.
 */
export function BossSpawnSpotsChip({ normalizedName }: Props) {
  const mode = useProgressTrackerStore((state) => state.activeMode);
  const shown = useBossSpawnStore((state) => shownBossSpawnsOn(state, normalizedName, mode));
  const clear = useBossSpawnStore((state) => state.clear);
  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);

  const config = getMapConfig(normalizedName);
  const variant = config?.variants.find(
    (v) => v.id === resolveVariantId(config.variants, storedVariantId ?? null),
  );
  const switchTo =
    config && variant && !variantHasAccurateMarkers(variant)
      ? config.variants.find((v) => v.id === markerVariantId(config.variants))
      : undefined;

  return (
    <div aria-live="polite" className="flex justify-center">
      {shown && (
        <div
          title={detailFor(shown.zonesWithoutSpots)}
          className="bg-background/95 border-border pointer-events-auto flex max-w-full items-center gap-2 rounded-full border py-1 pr-1 pl-1 text-xs shadow-md backdrop-blur-sm"
        >
          <BossPortrait pill={shown} className="h-6 w-6 rounded-full border" />
          <span className="min-w-0 truncate">
            {switchTo
              ? `This view can't place ${possessive(shown.name)} spawn spots`
              : `Showing ${possessive(shown.name)} possible spawn spots`}
          </span>
          <span className="sr-only">{detailFor(shown.zonesWithoutSpots)}</span>
          {switchTo && (
            <Button
              type="button"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs"
              onClick={() => {
                setMapVariant(normalizedName, switchTo.id);
              }}
            >
              Show on {switchTo.label}
            </Button>
          )}
          <button
            type="button"
            onClick={clear}
            aria-label={`Hide ${possessive(shown.name)} spawn spots`}
            title="Hide the spawn spots"
            className="hover:bg-muted focus-visible:ring-ring flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/** The chip's fuller explanation, for its hover text and screen readers. */
function detailFor(zonesWithoutSpots: readonly string[]): string {
  const missing =
    zonesWithoutSpots.length > 0 ? ` No spots are listed for ${listNames(zonesWithoutSpots)}.` : "";
  return `Possible spawn spots from tarkov.dev's data, not live sightings.${missing}`;
}
