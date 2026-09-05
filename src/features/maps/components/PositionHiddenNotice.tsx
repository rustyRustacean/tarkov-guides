"use client";

import { useCompanionPosition } from "@/features/companion/use-companion";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";

import {
  getMapConfig,
  markerVariantId,
  resolveVariantId,
  variantHasAccurateMarkers,
} from "../lib/map-config";
import { positionBelongsOnMap } from "../lib/raid-location";
import { useMapsStore } from "../store";

interface Props {
  normalizedName: string;
}

/**
 * "Your live position is on THIS map but the view you're on can't draw it -
 * one click fixes that."
 *
 * This is the anti-silent-failure companion to `variantHasAccurateMarkers`:
 * that gate unmounts every marker on uncalibrated 2D/3D variants with no
 * feedback, and a sticky 2D selection then hides the player marker for weeks
 * (exactly what happened). Auto-follow already switches the variant for users
 * who opted in; this notice covers everyone else the moment it matters, and
 * only then - no position, wrong map, or a variant that already shows markers
 * all render nothing.
 */
export function PositionHiddenNotice({ normalizedName }: Props) {
  const position = useCompanionPosition();
  const { data } = useTarkovGameData();
  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);

  if (!position) return null;
  if (!positionBelongsOnMap(position.map, normalizedName, data?.maps ?? [])) return null;

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
        Your live position is on this map, but this view can&apos;t place it.
      </span>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setMapVariant(normalizedName, target);
        }}
      >
        Show on {targetLabel}
      </Button>
    </div>
  );
}
