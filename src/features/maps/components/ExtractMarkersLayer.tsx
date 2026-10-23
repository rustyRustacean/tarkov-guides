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

/** The whole flag as one outline: stem and pennant together, straight top edge, rounded stem end. */
const FLAG_SHAPE = "M3.2 2.6 L23 9 L6.8 15.2 L6.8 27.8 A1.8 1.8 0 0 1 3.2 27.8 Z";

/**
 * A flag planted on the spot: the stem's rounded tip IS the location (the icon
 * is anchored there), the pennant flies to its right. Three layers share the
 * one outline (bold border, thin black line, dimmer inside); the colors come
 * from the stylesheet (`.exit-flag--*` in globals.css) so they are not baked
 * into the SVG.
 */
const FLAG_SVG =
  '<svg class="exit-flag-svg" viewBox="0 0 26 32" width="34" height="42" aria-hidden="true">' +
  `<path class="exit-flag-ring" d="${FLAG_SHAPE}"/>` +
  `<path class="exit-flag-inside" d="${FLAG_SHAPE}"/>` +
  `<path class="exit-flag-line" d="${FLAG_SHAPE}"/>` +
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
  /** The name is held open by the exit keys (the selected flag only). */
  opened: boolean;
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
 * at creation, so flipping the prop alone would change nothing.
 */
function ExitFlag({ exit, listed, selected, opened, center, onSelect }: FlagProps) {
  const [pinned, setPinned] = useState(false);
  const open = pinned || opened;
  const variant = variantFor(exit, listed);
  return (
    <Marker
      position={center}
      icon={ICONS[`${variant}:${selected ? "1" : "0"}`] ?? makeIcon(variant, selected)}
      keyboard={false}
      zIndexOffset={selected ? 1000 : open ? 900 : 500}
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
        key={open ? "pinned" : "hover"}
        direction="right"
        offset={[28, -26]}
        permanent={open}
        className={`exit-marker-label exit-marker-label--${variant}`}
      >
        {listed && exit.unknown ? (
          <>
            <span className="exit-marker-unknown-mark">???</span> {exit.name}
          </>
        ) : (
          exit.name
        )}
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
  const keyOpened = useExitPathStore((state) => state.keyOpened);
  const toggleSelected = useExitPathStore((state) => state.toggleSelected);

  // Test wiring: `testMode && ...` keeps map-data exits visible with no snip.
  const showOthers = showAll || (testMode && view.listed.length === 0);
  const shown: { exit: AppliedExit; listed: boolean }[] = [
    ...view.listed.map((exit) => ({ exit, listed: true })),
    ...(showOthers ? view.others.map((exit) => ({ exit, listed: false })) : []),
  ];

  // An exit picked with the keys is drawn even when nothing else of its kind is.
  if (selectedKey !== null && !shown.some(({ exit }) => exitKey(exit) === selectedKey)) {
    const picked = view.others.find((exit) => exitKey(exit) === selectedKey);
    if (picked) shown.push({ exit: picked, listed: false });
  }

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
            opened={keyOpened && selectedKey === key}
            center={gameCenter(exit.position.x, exit.position.z, calibration, imageBounds)}
            onSelect={toggleSelected}
          />
        );
      })}
    </>
  );
}
