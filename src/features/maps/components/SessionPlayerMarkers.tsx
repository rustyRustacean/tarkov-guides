"use client";

import L from "leaflet";
import { useMemo } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { positionBelongsOnMap } from "../lib/raid-location";
import { useSessionPlayerPositions } from "../session/use-session-positions";

import { chevronYawDeg, markerHtml, playerMarkerCenter } from "./PlayerMarker";

import type { VariantCalibration } from "../lib/leaflet-crs";
import type { SessionPlayerMarker } from "../session/use-session-positions";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  /** The map being viewed - a teammate is only drawn when their position was captured on this map. */
  normalizedName: string;
  /** Present only on a calibrated 2D/3D variant - projects positions through its affine, matching `PlayerMarker`/`TaskMarkersLayer`. */
  calibration?: VariantCalibration | undefined;
  /** The image's contain-fit bounds a calibrated variant projects into. */
  imageBounds?: LatLngBoundsExpression | undefined;
  /** The map's `coordinateRotation` (degrees), added to each yaw so chevrons face the same way in-game and on the map. */
  coordinateRotation: number;
}

function SessionPlayerMarker({
  player,
  calibration,
  imageBounds,
  coordinateRotation,
}: {
  player: SessionPlayerMarker;
  calibration: VariantCalibration | undefined;
  imageBounds: LatLngBoundsExpression | undefined;
  coordinateRotation: number;
}) {
  const { position, color, name } = player;
  const icon = useMemo(
    () =>
      L.divIcon({
        html: markerHtml(chevronYawDeg(position.yaw, coordinateRotation), color),
        className: "player-marker player-marker-other",
        iconSize: [60, 60],
        iconAnchor: [30, 30],
      }),
    [position.yaw, coordinateRotation, color],
  );

  return (
    <Marker
      position={playerMarkerCenter(position, calibration, imageBounds)}
      icon={icon}
      interactive={false}
      zIndexOffset={900}
    >
      <Tooltip direction="top" offset={[0, -14]} permanent className="player-marker-label">
        {name}
      </Tooltip>
    </Marker>
  );
}

/**
 * Everyone else in the collaborative session, drawn on the map the same way
 * the local player is - one chevron each, in that participant's own session
 * color, labelled with their name.
 *
 * Positions come from the companion's screenshot pipeline, so a teammate
 * appears once they've taken an in-raid screenshot and their marker moves on
 * their next one; it is a shared last-known position, not continuous tracking.
 * Renders nothing outside a session, or when nobody has published a position.
 *
 * The map gate is `positionBelongsOnMap`, exactly as for the local player: a
 * teammate on Reserve is never drawn on the Woods tab just because that's what
 * you have open. Their own marker is deliberately excluded from
 * `useSessionPlayerPositions` - `PlayerMarker` already draws it locally,
 * without waiting on a round trip.
 */
export function SessionPlayerMarkers({
  normalizedName,
  calibration,
  imageBounds,
  coordinateRotation,
}: Props) {
  const players = useSessionPlayerPositions();
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];

  return (
    <>
      {players
        .filter((player) => positionBelongsOnMap(player.position.map, normalizedName, maps))
        .map((player) => (
          <SessionPlayerMarker
            key={player.id}
            player={player}
            calibration={calibration}
            imageBounds={imageBounds}
            coordinateRotation={coordinateRotation}
          />
        ))}
    </>
  );
}
