"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { useCompanionPosition } from "@/features/companion/use-companion";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { gameCenter, type VariantCalibration } from "../lib/leaflet-crs";
import { positionBelongsOnMap } from "../lib/raid-location";

import type { CompanionPosition } from "@/features/companion/companion-config";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  /** The map being viewed: a position is only drawn when it was actually captured on this map. */
  normalizedName: string;
  /** Present only on a calibrated 2D/3D variant: projects the position through its affine, matching `TaskMarkersLayer`. */
  calibration?: VariantCalibration | undefined;
  /** The image's contain-fit bounds a calibrated variant projects into. */
  imageBounds?: LatLngBoundsExpression | undefined;
  /** The map's `coordinateRotation` (degrees), added to the screenshot yaw so the chevron faces the same way in-game and on the map. */
  coordinateRotation: number;
}

/**
 * Leaflet `[lat, lng]` for a player position: the same projection
 * `TaskMarkersLayer` uses (`[z, x]` in game space, or the variant's affine
 * when calibrated), so the player dot lands on the same frame as task pins.
 */
export function playerMarkerCenter(
  position: CompanionPosition,
  calibration: VariantCalibration | undefined,
  imageBounds: LatLngBoundsExpression | undefined,
): [number, number] {
  return gameCenter(position.x, position.z, calibration, imageBounds);
}

/** Screenshot yaw (deg) plus the map's coordinate rotation, or null when facing is unknown. */
export function chevronYawDeg(yaw: number | null, coordinateRotation: number): number | null {
  return yaw === null ? null : yaw + coordinateRotation;
}

/**
 * A participant color safe to drop into the marker's inline `fill`, or `""`
 * when there's nothing to override with (the stylesheet's own accent then
 * applies). `markerHtml` builds an SVG string that Leaflet injects as raw HTML,
 * so a color reaching it from another participant's presence is untrusted
 * input by definition; only the exact hex shape this app's own palette
 * produces gets through.
 */
export function safeMarkerColor(color: string | undefined): string {
  return color !== undefined && /^#[0-9a-f]{3,8}$/i.test(color) ? color : "";
}

/** `color` tints one participant's marker (session teammates); omitted, the stylesheet's own accent applies (the local player). */
export function markerHtml(yawDeg: number | null, color?: string): string {
  const fill = safeMarkerColor(color);
  const style = fill === "" ? "" : ` style="fill:${fill}"`;
  if (yawDeg === null) {
    // No facing data: a plain dot.
    return `<svg class="player-marker-svg" viewBox="0 0 60 60"><circle cx="30" cy="30" r="6"${style}/></svg>`;
  }
  // A single chevron (minimap-style), pointing up at 0deg, rotated as one piece.
  return (
    `<svg class="player-marker-svg" viewBox="0 0 60 60">` +
    `<g style="transform:rotate(${yawDeg.toFixed(1)}deg);transform-origin:30px 30px">` +
    `<path d="M 30 12 L 42 40 L 30 33 L 18 40 Z" stroke-linejoin="round" stroke-linecap="round"${style}/>` +
    `</g></svg>`
  );
}

/**
 * The player's live position on the map, driven by the companion's in-raid
 * screenshot pipeline. A single moving marker (rotating chevron + profile
 * name); subsequent positions move it rather than stack. Renders nothing
 * when the companion isn't running or hasn't captured a position yet.
 *
 * A position is only drawn on the map it was actually captured on. Screenshot
 * filenames carry coordinates but no map, so the companion tags each one with
 * the raid's location; without that tag the same `x`/`z` would happily render
 * on whatever map happened to be open, which reads as a real in-game position
 * and is worse than showing nothing.
 */
export function PlayerMarker({
  normalizedName,
  calibration,
  imageBounds,
  coordinateRotation,
}: Props) {
  const position = useCompanionPosition();
  const { data } = useTarkovGameData();
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const name = profiles.find((profile) => profile.id === activeProfileId)?.name ?? "";

  const icon = useMemo(() => {
    if (!position) return null;
    return L.divIcon({
      html: markerHtml(chevronYawDeg(position.yaw, coordinateRotation)),
      className: "player-marker",
      iconSize: [60, 60],
      iconAnchor: [30, 30],
    });
  }, [position, coordinateRotation]);

  if (!position || !icon) return null;
  if (!positionBelongsOnMap(position.map, normalizedName, data?.maps ?? [])) return null;

  const center = playerMarkerCenter(position, calibration, imageBounds);

  return (
    <Marker position={center} icon={icon} interactive={false} zIndexOffset={1000}>
      {name ? (
        <Tooltip direction="top" offset={[0, -14]} permanent className="player-marker-label">
          {name}
        </Tooltip>
      ) : null}
    </Marker>
  );
}
