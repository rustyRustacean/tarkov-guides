"use client";

import L from "leaflet";
import { useState } from "react";
import { Marker, Tooltip } from "react-leaflet";

import { useExitPathStore } from "../exit-path-store";
import { useExitPath } from "../hooks/use-exit-path";
import { exitKey } from "../lib/exit-path";
import { gameCenter, type VariantCalibration } from "../lib/leaflet-crs";

import type { AppliedExit } from "../lib/exit-snip";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  normalizedMapName: string;
  /** Present only for a manually-calibrated 2D/3D variant: pins project through its affine, same as task markers. */
  calibration?: VariantCalibration | undefined;
  imageBounds?: LatLngBoundsExpression | undefined;
}

/** `other` is an exit the snip did not list, shown only by "Show all exits" or the tester. */
type ExitVariant = "extract" | "unknown" | "transit" | "other";

function variantFor(exit: AppliedExit, listed: boolean): ExitVariant {
  if (!listed) return "other";
  if (exit.kind === "transit") return "transit";
  return exit.unknown ? "unknown" : "extract";
}

function labelFor(exit: AppliedExit, listed: boolean): string {
  return listed && exit.unknown ? `??? ${exit.name}` : exit.name;
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

function makeIcon(variant: ExitVariant, selected: boolean): L.DivIcon {
  return L.divIcon({
    html: FLAG_SVG,
    className: `exit-flag exit-flag--${variant}${selected ? " exit-flag--selected" : ""}`,
    iconSize: [34, 42],
    iconAnchor: [7, 38],
  });
}

const VARIANTS: readonly ExitVariant[] = ["extract", "unknown", "transit", "other"];
const ICONS: Readonly<Record<string, L.DivIcon>> = Object.fromEntries(
  VARIANTS.flatMap((variant) => [
    [`${variant}:0`, makeIcon(variant, false)],
    [`${variant}:1`, makeIcon(variant, true)],
  ]),
);

interface FlagProps {
  exit: AppliedExit;
  listed: boolean;
  selected: boolean;
  center: [number, number];
  onSelect: (key: string) => void;
}

/**
 * One flag. Hover shows the name; a single click selects the exit as the path
 * target (click again to deselect); a double click pins the name open.
 *
 * A double click also fires two single clicks first, which select and then
 * deselect, so it nets out to no change in the selection.
 *
 * The tooltip is re-keyed on `pinned` because Leaflet reads `permanent` once,
 * at creation - flipping the prop alone would change nothing.
 */
function ExitFlag({ exit, listed, selected, center, onSelect }: FlagProps) {
  const [pinned, setPinned] = useState(false);
  const variant = variantFor(exit, listed);
  return (
    <Marker
      position={center}
      icon={ICONS[`${variant}:${selected ? "1" : "0"}`] ?? makeIcon(variant, selected)}
      keyboard={false}
      zIndexOffset={selected ? 1000 : pinned ? 900 : 500}
      eventHandlers={{
        click: () => {
          onSelect(exitKey(exit));
        },
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
        {labelFor(exit, listed)}
      </Tooltip>
    </Marker>
  );
}

/**
 * The exits of the map you're viewing:
 * - the ones the exit list snip named (flags, `???` for unknown availability),
 * - plus, when "Show all exits" or the tester is on, every other exit of the
 *   map from the map data, dimmed.
 *
 * Snip exits are shown only on the tab of the raid the snip was read in
 * (resolved through the same `raidLocation` -> tab lookup the player marker
 * uses), so an exit is never drawn on a map it was not read for.
 */
export function ExtractMarkersLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const view = useExitPath(normalizedMapName);
  const showAll = useExitPathStore((state) => state.showAllExits);
  const testMode = useExitPathStore((state) => state.testMode);
  const selectedKey = useExitPathStore((state) => state.selectedKey);
  const toggleSelected = useExitPathStore((state) => state.toggleSelected);

  // TEMP-TESTER: `testMode && ...` keeps map-data exits visible with no snip.
  const showOthers = showAll || (testMode && view.listed.length === 0);
  const shown: { exit: AppliedExit; listed: boolean }[] = [
    ...view.listed.map((exit) => ({ exit, listed: true })),
    ...(showOthers ? view.others.map((exit) => ({ exit, listed: false })) : []),
  ];

  return (
    <>
      {shown.map(({ exit, listed }) => {
        if (exit.position === null) return null;
        const key = exitKey(exit);
        return (
          <ExitFlag
            key={key}
            exit={exit}
            listed={listed}
            selected={selectedKey === key}
            center={gameCenter(exit.position.x, exit.position.z, calibration, imageBounds)}
            onSelect={toggleSelected}
          />
        );
      })}
    </>
  );
}
