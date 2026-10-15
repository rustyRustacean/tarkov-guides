"use client";

import L from "leaflet";
import { useMemo, useState } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useExitSnipStore } from "../exit-snip-store";
import { gameCenter, type VariantCalibration } from "../lib/leaflet-crs";
import { tabForRaidLocation } from "../lib/raid-location";

import type { AppliedExit } from "../lib/exit-snip";
import type { RawMap } from "@/shared/lib/tarkov-api/types";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  normalizedMapName: string;
  /** Present only for a manually-calibrated 2D/3D variant: pins project through its affine, same as task markers. */
  calibration?: VariantCalibration | undefined;
  imageBounds?: LatLngBoundsExpression | undefined;
}

type ExitVariant = "extract" | "unknown" | "transit";

function variantFor(exit: AppliedExit): ExitVariant {
  if (exit.kind === "transit") return "transit";
  return exit.unknown ? "unknown" : "extract";
}

function labelFor(exit: AppliedExit): string {
  return exit.unknown ? `??? ${exit.name}` : exit.name;
}

/**
 * A flag planted on the spot: the pole's foot IS the location (the icon is
 * anchored there), the pennant flies to its right. Colors come from the
 * stylesheet (`.exit-flag--*` in globals.css) so they follow the theme rather
 * than being baked into the SVG.
 */
const FLAG_SVG =
  '<svg class="exit-flag-svg" viewBox="0 0 26 32" width="34" height="42" aria-hidden="true">' +
  '<path class="exit-flag-pole" d="M5 29V3"/>' +
  '<path class="exit-flag-pennant" d="M5.6 3.6 L23 9 L5.6 15.2 Z"/>' +
  '<circle class="exit-flag-foot" cx="5" cy="29" r="2.4"/>' +
  "</svg>";

const ICONS: Readonly<Record<ExitVariant, L.DivIcon>> = {
  extract: L.divIcon({
    html: FLAG_SVG,
    className: "exit-flag exit-flag--extract",
    iconSize: [34, 42],
    iconAnchor: [7, 38],
  }),
  unknown: L.divIcon({
    html: FLAG_SVG,
    className: "exit-flag exit-flag--unknown",
    iconSize: [34, 42],
    iconAnchor: [7, 38],
  }),
  transit: L.divIcon({
    html: FLAG_SVG,
    className: "exit-flag exit-flag--transit",
    iconSize: [34, 42],
    iconAnchor: [7, 38],
  }),
};

interface FlagProps {
  exit: AppliedExit;
  center: [number, number];
}

/**
 * One flag. The name shows while the pointer is over it; a click pins the
 * name open (click again to put it away), so a crowded map stays readable
 * until you ask about a specific exit.
 *
 * The tooltip is re-keyed on `pinned` because Leaflet reads `permanent` once,
 * at creation - flipping the prop alone would change nothing.
 */
function ExitFlag({ exit, center }: FlagProps) {
  const [pinned, setPinned] = useState(false);
  const variant = variantFor(exit);
  return (
    <Marker
      position={center}
      icon={ICONS[variant]}
      keyboard={false}
      zIndexOffset={pinned ? 900 : 500}
      eventHandlers={{
        click: () => {
          setPinned((current) => !current);
        },
      }}
    >
      <Tooltip
        key={pinned ? "pinned" : "hover"}
        direction="right"
        offset={[28, -26]}
        permanent={pinned}
        className={`exit-marker-label exit-marker-label--${variant}`}
      >
        {labelFor(exit)}
      </Tooltip>
    </Marker>
  );
}

/**
 * The exits the player snipped from the in-raid exit list, drawn on the map
 * they belong to.
 *
 * Shown only on the tab of the raid the snip was read in - resolved through
 * the same `raidLocation` -> tab lookup the player marker uses, so an exit is
 * never drawn on a map it was not read for. Rendered for the lifetime of the
 * raid (the store is cleared when the next raid starts).
 */
export function ExtractMarkersLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const snip = useExitSnipStore((state) => state.snip);
  const { data } = useTarkovGameData();
  const maps = useMemo<readonly RawMap[]>(() => data?.maps ?? [], [data]);

  if (snip === null) return null;
  if (tabForRaidLocation(snip.nameId, maps) !== normalizedMapName) return null;

  return (
    <>
      {snip.exits.map((exit) => {
        if (exit.position === null) return null;
        return (
          <ExitFlag
            // `appliedAt` in the key: a fresh snip starts every flag closed.
            key={`${String(snip.appliedAt)}:${exit.kind}:${exit.id}`}
            exit={exit}
            center={gameCenter(exit.position.x, exit.position.z, calibration, imageBounds)}
          />
        );
      })}
    </>
  );
}
