"use client";

import L from "leaflet";
import { useState } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { useListedExits } from "../hooks/use-listed-exits";
import { gameCenter, type VariantCalibration } from "../lib/leaflet-crs";

import type { AppliedExit } from "../lib/exit-snip";
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

function makeIcon(variant: ExitVariant): L.DivIcon {
  return L.divIcon({
    html: FLAG_SVG,
    className: `exit-flag exit-flag--${variant}`,
    iconSize: [34, 42],
    iconAnchor: [7, 38],
  });
}

const ICONS: Readonly<Record<ExitVariant, L.DivIcon>> = {
  extract: makeIcon("extract"),
  unknown: makeIcon("unknown"),
  transit: makeIcon("transit"),
};

interface FlagProps {
  exit: AppliedExit;
  center: [number, number];
}

/**
 * One flag. Hover shows the name; a double click pins it open.
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
        dblclick: () => {
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
 * The exits of the map you're viewing that the exit list snip named (flags,
 * `???` for unknown availability).
 *
 * Snip exits are shown only on the tab of the raid the snip was read in
 * (resolved through the same `raidLocation` -> tab lookup the player marker
 * uses), so an exit is never drawn on a map it was not read for.
 */
export function ExtractMarkersLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const exits = useListedExits(normalizedMapName);

  return (
    <>
      {exits.map((exit) => {
        if (exit.position === null) return null;
        return (
          <ExitFlag
            key={`${exit.kind}:${exit.id}`}
            exit={exit}
            center={gameCenter(exit.position.x, exit.position.z, calibration, imageBounds)}
          />
        );
      })}
    </>
  );
}
