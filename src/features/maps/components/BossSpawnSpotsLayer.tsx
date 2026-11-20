"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { cn } from "@/shared/ui/lib/cn";

import { shownBossSpawnsOn, useBossSpawnStore } from "../boss-spawn-store";
import { gameCenter, type PlacementCalibration } from "../lib/leaflet-crs";

import { TONE_BORDER, initials } from "./BossStrip";

import type { ShownBossSpawns } from "../boss-spawn-store";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  normalizedMapName: string;
  /** Present only for a manually-calibrated 2D/3D variant: spots project through its affine, same as task markers. */
  calibration?: PlacementCalibration | undefined;
  imageBounds?: LatLngBoundsExpression | undefined;
}

/** A spot marker's width and height in px; its center sits on the spot. */
const SPOT_SIZE = 26;

/**
 * One spot's icon: the boss's face in its tone-colored frame, the boss
 * strip's portrait shrunk. Built with DOM calls rather than an HTML string,
 * so the portrait URL never passes through markup. Every marker needs its
 * own icon: Leaflet appends a `DivIcon`'s element itself to the marker, so
 * one shared element would hop from marker to marker.
 */
function spotIcon(shown: Pick<ShownBossSpawns, "name" | "imagePortraitLink" | "tone">): L.DivIcon {
  const frame = document.createElement("div");
  frame.className = cn(
    "bg-muted text-muted-foreground flex h-full w-full items-center justify-center overflow-hidden rounded-md border-2 text-[9px] font-semibold shadow-md",
    TONE_BORDER[shown.tone],
  );
  const showInitials = (): void => {
    frame.textContent = initials(shown.name);
  };
  if (shown.imagePortraitLink) {
    const image = document.createElement("img");
    image.alt = "";
    image.className = "h-full w-full object-cover";
    // A missing or blocked asset falls back to initials, like `BossPortrait`.
    image.addEventListener("error", showInitials, { once: true });
    image.src = shown.imagePortraitLink;
    frame.append(image);
  } else {
    showInitials();
  }
  return L.divIcon({
    html: frame,
    className: "boss-spawn-spot",
    iconSize: [SPOT_SIZE, SPOT_SIZE],
    iconAnchor: [SPOT_SIZE / 2, SPOT_SIZE / 2],
  });
}

/**
 * The possible spawn spots of the boss whose card's "Show on map" was used
 * (`boss-spawn-store.ts`), as small portraits; hovering one names its zone.
 * They are the map's spawn points inside the boss's spawn zones, from
 * tarkov.dev's data, not sightings. Mounted only on views that place
 * markers accurately (`MapViewer`'s `showMarkers`), and draws nothing unless
 * something was shown for this map and the active mode.
 */
export function BossSpawnSpotsLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const mode = useProgressTrackerStore((state) => state.activeMode);
  const shown = useBossSpawnStore((state) => shownBossSpawnsOn(state, normalizedMapName, mode));
  const markers = useMemo(
    () => (shown ? shown.spots.map((spot) => ({ spot, icon: spotIcon(shown) })) : []),
    [shown],
  );

  return (
    <>
      {markers.map(({ spot, icon }) => (
        <Marker
          key={`${String(spot.x)}:${String(spot.z)}`}
          position={gameCenter(spot.x, spot.z, calibration, imageBounds)}
          icon={icon}
          keyboard={false}
          zIndexOffset={400}
        >
          <Tooltip direction="top" offset={[0, -SPOT_SIZE / 2]}>
            <span className="font-semibold">{spot.zone}</span>
            <br />
            Possible spawn spot
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
