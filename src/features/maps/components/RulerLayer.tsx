"use client";

import L from "leaflet";
import { useMemo } from "react";
import { CircleMarker, Marker, Polyline, Tooltip, useMapEvents } from "react-leaflet";

import { useRulerRoute } from "../hooks/use-ruler-route";
import { gamePointFromLatLng } from "../lib/exit-path-geo";
import { walkingRouteAvailable } from "../lib/exit-path-maps";
import { gameCenter, type VariantCalibration } from "../lib/leaflet-crs";
import { rulerPointA, rulerPointB, useRulerStore } from "../ruler-store";

import { travelTime } from "./ExitPathControls";

import type { Point } from "../lib/exit-path";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  normalizedMapName: string;
  calibration?: VariantCalibration | undefined;
  imageBounds?: LatLngBoundsExpression | undefined;
}

const RULER_LAYERS: readonly { weight: number; opacity: number; color: string }[] = [
  { weight: 10, opacity: 0.14, color: "#facc15" },
  { weight: 5, opacity: 0.28, color: "#fde047" },
  { weight: 2.25, opacity: 0.98, color: "#fefce8" },
];

/**
 * The ruler's end markers: a lettered pin whose tip is the measured spot, so
 * they cannot be mistaken for a task dot or a flag. Styled in the stylesheet
 * (`.ruler-pin`), and anchored on the tip.
 */
function pinIcon(letter: string): L.DivIcon {
  return L.divIcon({
    html: `<span class="ruler-pin-letter">${letter}</span>`,
    className: "ruler-pin",
    iconSize: [26, 34],
    iconAnchor: [13, 34],
  });
}
const PIN_A = pinIcon("A");
const PIN_B = pinIcon("B");

/** The point halfway along a path, by walked length (so the label sits on the line). */
export function midpointAlong(points: readonly Point[]): Point | null {
  const first = points[0];
  if (first === undefined) return null;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    if (from && to) total += Math.hypot(to.x - from.x, to.z - from.z);
  }
  let remaining = total / 2;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    if (!from || !to) continue;
    const leg = Math.hypot(to.x - from.x, to.z - from.z);
    if (leg >= remaining && leg > 0) {
      const t = remaining / leg;
      return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
    }
    remaining -= leg;
  }
  return first;
}

/** Places the ruler's points where the map is clicked. Mounted only while the tool is on. */
function RulerClicks({ normalizedMapName, calibration, imageBounds }: Props) {
  const place = useRulerStore((state) => state.place);
  useMapEvents({
    click(event) {
      place(gamePointFromLatLng(event.latlng, calibration, imageBounds), normalizedMapName);
    },
  });
  return null;
}

/**
 * The ruler: two points and the walking route between them, with its
 * distance and travel time written on the line itself (same colours as the
 * exit path line).
 */
export function RulerLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const on = useRulerStore((state) => state.on);
  const a = useRulerStore((state) => rulerPointA(state, normalizedMapName));
  const b = useRulerStore((state) => rulerPointB(state, normalizedMapName));
  const { route, unreachable } = useRulerRoute(normalizedMapName);

  const points = useMemo(
    () => route?.points.map((p) => gameCenter(p.x, p.z, calibration, imageBounds)) ?? null,
    [route, calibration, imageBounds],
  );
  const middle = useMemo(() => (route ? midpointAlong(route.points) : null), [route]);

  if (!on || !walkingRouteAvailable(normalizedMapName)) return null;
  const centerA = a ? gameCenter(a.x, a.z, calibration, imageBounds) : null;
  const centerB = b ? gameCenter(b.x, b.z, calibration, imageBounds) : null;
  const centerMiddle = middle ? gameCenter(middle.x, middle.z, calibration, imageBounds) : null;

  return (
    <>
      <RulerClicks
        normalizedMapName={normalizedMapName}
        calibration={calibration}
        imageBounds={imageBounds}
      />
      {points && points.length > 1
        ? RULER_LAYERS.map((layer) => (
            <Polyline
              key={layer.weight}
              positions={points}
              color={layer.color}
              weight={layer.weight}
              opacity={layer.opacity}
              lineCap="round"
              lineJoin="round"
              interactive={false}
            />
          ))
        : null}
      {centerA ? (
        <Marker
          position={centerA}
          icon={PIN_A}
          interactive={false}
          keyboard={false}
          zIndexOffset={800}
        />
      ) : null}
      {centerB ? (
        <Marker
          position={centerB}
          icon={PIN_B}
          interactive={false}
          keyboard={false}
          zIndexOffset={800}
        />
      ) : null}
      {route && centerMiddle ? (
        <CircleMarker center={centerMiddle} radius={1} weight={0} interactive={false}>
          <Tooltip
            permanent
            direction="top"
            offset={[0, -4]}
            className="exit-marker-label exit-marker-label--measure"
          >
            <span className="font-bold text-red-600 dark:text-red-500">
              {String(Math.round(route.length))} m
            </span>
            ,{" "}
            <span className="font-bold text-blue-600 dark:text-sky-400">
              {travelTime(route.length)}
            </span>
          </Tooltip>
        </CircleMarker>
      ) : null}
      {unreachable && centerB ? (
        <CircleMarker center={centerB} radius={1} weight={0} interactive={false}>
          <Tooltip
            permanent
            direction="top"
            offset={[0, -10]}
            className="exit-marker-label exit-marker-label--measure"
          >
            No walkable route
          </Tooltip>
        </CircleMarker>
      ) : null}
    </>
  );
}
