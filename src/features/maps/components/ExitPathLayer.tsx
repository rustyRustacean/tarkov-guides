"use client";

import { CircleMarker, Polyline, useMapEvents } from "react-leaflet";

import { useExitPathStore } from "../exit-path-store";
import { useExitPath } from "../hooks/use-exit-path";
import { gamePointFromLatLng } from "../lib/exit-path-geo";
import { gameCenter, type VariantCalibration } from "../lib/leaflet-crs";

import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  normalizedMapName: string;
  calibration?: VariantCalibration | undefined;
  imageBounds?: LatLngBoundsExpression | undefined;
}

/**
 * The route to an exit is deliberately unlike the task connectors, which are
 * solid, glowing, coloured lines: this one is a dark-cased trail of white
 * dashes. Nothing else on the map is dashed or cased in black, so it cannot be
 * taken for a task line.
 */
const PATH_LAYERS: readonly {
  weight: number;
  opacity: number;
  color: string;
  dashArray?: string;
}[] = [
  { weight: 5, opacity: 0.8, color: "#000000" },
  {
    weight: 2.5,
    opacity: 1,
    color: "#ffffff",
    dashArray: "1 9",
  },
];

/**
 * TEMP-TESTER (to be removed, with its use below and the start marker):
 * places the tester point where the map is clicked. Mounted only while testing.
 */
function TesterClicks({ calibration, imageBounds }: Omit<Props, "normalizedMapName">) {
  const setTestPoint = useExitPathStore((state) => state.setTestPoint);
  useMapEvents({
    click(event) {
      setTestPoint(gamePointFromLatLng(event.latlng, calibration, imageBounds));
    },
  });
  return null;
}

/**
 * The path from the known position to the target exit, plus the tester's
 * stand-in position. Rendered inside the map; the controls (outside it) read
 * the same {@link useExitPath} view, so the text and the line cannot differ.
 */
export function ExitPathLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const view = useExitPath(normalizedMapName);
  const testMode = useExitPathStore((state) => state.testMode);

  const points = view.target?.route?.points.map((point) =>
    gameCenter(point.x, point.z, calibration, imageBounds),
  );

  return (
    <>
      {testMode ? <TesterClicks calibration={calibration} imageBounds={imageBounds} /> : null}
      {testMode && view.start ? (
        <>
          <CircleMarker
            center={gameCenter(view.start.x, view.start.z, calibration, imageBounds)}
            radius={16}
            weight={0}
            fillColor="#22d3ee"
            fillOpacity={0.18}
            interactive={false}
          />
          <CircleMarker
            center={gameCenter(view.start.x, view.start.z, calibration, imageBounds)}
            radius={7}
            weight={2.5}
            color="#0a0a0a"
            fillColor="#ecfeff"
            fillOpacity={1}
            interactive={false}
          />
        </>
      ) : null}
      {points && points.length > 1
        ? PATH_LAYERS.map((layer) => (
            <Polyline
              key={layer.weight}
              positions={points}
              color={layer.color}
              weight={layer.weight}
              opacity={layer.opacity}
              {...(layer.dashArray ? { dashArray: layer.dashArray } : {})}
              lineCap="round"
              lineJoin="round"
              interactive={false}
            />
          ))
        : null}
    </>
  );
}
