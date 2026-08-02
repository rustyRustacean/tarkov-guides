"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { useCompanionPosition } from "@/features/companion/use-companion";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { calibratedLatLng, type VariantCalibration } from "../lib/leaflet-crs";

import type { CompanionPosition } from "@/features/companion/companion-config";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  /** Present only on a calibrated 2D/3D variant - projects the position through its affine, matching `TaskMarkersLayer`. */
  calibration?: VariantCalibration | undefined;
  /** The image's contain-fit bounds a calibrated variant projects into. */
  imageBounds?: LatLngBoundsExpression | undefined;
  /** The map's `coordinateRotation` (degrees), added to the screenshot yaw so the chevron faces the same way in-game and on the map. */
  coordinateRotation: number;
}

/**
 * Leaflet `[lat, lng]` for a player position - the same projection
 * `TaskMarkersLayer` uses (`[z, x]` in game space, or the variant's affine
 * when calibrated), so the player dot lands on the same frame as task pins.
 */
export function playerMarkerCenter(
  position: CompanionPosition,
  calibration: VariantCalibration | undefined,
  imageBounds: LatLngBoundsExpression | undefined,
): [number, number] {
  if (calibration && imageBounds) {
    const latLng = calibratedLatLng(calibration, position.x, position.z, imageBounds);
    return [latLng.lat, latLng.lng];
  }
  return [position.z, position.x];
}

/** Screenshot yaw (deg) plus the map's coordinate rotation, or null when facing is unknown. */
export function chevronYawDeg(yaw: number | null, coordinateRotation: number): number | null {
  return yaw === null ? null : yaw + coordinateRotation;
}

function markerHtml(yawDeg: number | null): string {
  if (yawDeg === null) {
    // No facing data - a plain dot.
    return `<svg class="player-marker-svg" viewBox="0 0 60 60"><circle cx="30" cy="30" r="6"/></svg>`;
  }
  // A single chevron (minimap-style), pointing up at 0deg, rotated as one piece.
  return (
    `<svg class="player-marker-svg" viewBox="0 0 60 60">` +
    `<g style="transform:rotate(${yawDeg.toFixed(1)}deg);transform-origin:30px 30px">` +
    `<path d="M 30 12 L 42 40 L 30 33 L 18 40 Z" stroke-linejoin="round" stroke-linecap="round"/>` +
    `</g></svg>`
  );
}

/**
 * The player's live position on the map, driven by the companion's in-raid
 * screenshot pipeline. A single moving marker (rotating chevron + profile
 * name) - subsequent positions move it rather than stack. Renders nothing
 * when the companion isn't running or hasn't captured a position yet.
 */
export function PlayerMarker({ calibration, imageBounds, coordinateRotation }: Props) {
  const position = useCompanionPosition();
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
