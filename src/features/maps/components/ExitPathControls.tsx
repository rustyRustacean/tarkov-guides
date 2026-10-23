"use client";

import { useExitSnipPreference } from "@/features/companion/use-companion";
import { Button } from "@/shared/ui/button/Button";

import { useExitPathStore } from "../exit-path-store";
import { useExitSnipStore } from "../exit-snip-store";
import { useExitPath, type ExitPathView } from "../hooks/use-exit-path";
import { exitPathAvailable, walkingRouteAvailable } from "../lib/exit-path-maps";
import {
  getMapConfig,
  markerVariantId,
  resolveVariantId,
  variantHasAccurateMarkers,
} from "../lib/map-config";
import { useMapsStore } from "../store";

interface Props {
  normalizedName: string;
}

/**
 * Average speed used for the time estimate, in metres per second: a steady
 * run with the odd sprint. It is a rough guide (stamina, weight, hills and
 * stopping all change it), so the time is shown with a "≈".
 */
export const TRAVEL_SPEED_M_PER_S = 4;

/** A travel time like `≈ 45 s` or `≈ 2 min 10 s` for a distance in metres. */
export function travelTime(meters: number): string {
  const seconds = Math.max(1, Math.round(meters / TRAVEL_SPEED_M_PER_S));
  if (seconds < 60) return `≈ ${String(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `≈ ${String(minutes)} min` : `≈ ${String(minutes)} min ${String(rest)} s`;
}

/** The route line split so the distance and the time can be coloured on their own. */
export interface PathParts {
  name: string;
  /** " (closest)" when the exit was picked automatically, else empty. */
  how: string;
  distance: string;
  time: string;
}

/** The parts of the route line, or `null` when there is no route to describe. */
export function pathParts(view: ExitPathView): PathParts | null {
  const target = view.target;
  if (view.status !== "ready" || !target?.route) return null;
  const how = target.reason === "selected" ? "" : " (closest)";
  return {
    name: target.exit.name,
    how,
    distance: `${String(Math.round(target.route.length))} m`,
    time: travelTime(target.route.length),
  };
}

/** The one line shown beside the buttons while "Go to Exit" is on. */
export function describePath(view: ExitPathView): string | null {
  switch (view.status) {
    case "off":
      return null;
    case "no-exits":
      return "Snip the exit list first.";
    case "no-position":
      return "Needs a position: take an in-raid screenshot.";
    case "ready": {
      if (view.routing) return "Finding the route...";
      if (view.target === null) return "No available exit to route to.";
      if (view.target.route === null) {
        return `No walkable route to ${view.target.exit.name} found.`;
      }
      const meters = String(Math.round(view.target.route.length));
      const how = view.target.reason === "selected" ? "" : " (closest)";
      const time = travelTime(view.target.route.length);
      return `${view.target.exit.name}${how}: ${meters} m, ${time}`;
    }
  }
}

/** Toggle look: an outlined button that takes the accent colour while it is on. */
function toggleClass(on: boolean): string {
  const base = "shadow-sm backdrop-blur-sm";
  return on
    ? `${base} border-primary bg-primary/20 text-primary hover:bg-primary/30`
    : `${base} bg-background/90`;
}

/**
 * Exit path controls on the map screen.
 *
 * - **Show all exits**: every exit of the map, not just the ones the snip named.
 * - **Go to Exit**: a path from the last known position to the clicked exit,
 *   else the closest available one. It follows the position as it updates.
 *
 * The path walks the map's walkable mesh, or its obstacle grid where the mesh
 * cannot answer (`server/route-service.ts`). Go to Exit is only offered where
 * that data exists (`walkingRouteAvailable`); elsewhere the exit list and Show
 * all exits still work.
 */
export function ExitPathControls({ normalizedName }: Props) {
  const view = useExitPath(normalizedName);
  const showAll = useExitPathStore((state) => state.showAllExits);
  const pathOn = useExitPathStore((state) => state.pathOn);
  const setShowAll = useExitPathStore((state) => state.setShowAllExits);
  const setPathOn = useExitPathStore((state) => state.setPathOn);
  const clearSelection = useExitPathStore((state) => state.clearSelection);

  const summary = describePath(view);
  const appliedSnip = useExitSnipStore((state) => state.snip);
  // What the page holds from the exit list snip, so "nothing on the map" always
  // has a visible reason: not read yet, read for another map, or here.
  const [exitReadingOn] = useExitSnipPreference();
  let snipNote: string;
  if (!exitReadingOn) {
    snipNote = 'Exit list reading is OFF: tick "Exit list from snip" in EFT Companion';
  } else if (appliedSnip === null) {
    snipNote = "Exit list: waiting for your snip (O, then Win+Shift+S)";
  } else if (view.listed.length > 0) {
    snipNote = `Exit list: ${String(view.listed.length)} on this map`;
  } else {
    snipNote = `Exit list was read for ${appliedSnip.nameId}: open that map`;
  }
  const parts = pathParts(view);

  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);

  /**
   * Flags and the path are markers, and markers are only drawn on views that
   * place them accurately (not an uncalibrated 2D/3D image, which several maps
   * open on). Turning one of these controls on is a clear "show me", so the
   * view is moved to one that can draw them instead of silently showing nothing.
   */
  const ensureMarkerView = () => {
    const config = getMapConfig(normalizedName);
    if (!config) return;
    const current = config.variants.find(
      (variant) => variant.id === resolveVariantId(config.variants, storedVariantId ?? null),
    );
    if (current && variantHasAccurateMarkers(current)) return;
    const target = markerVariantId(config.variants);
    if (target) setMapVariant(normalizedName, target);
  };
  if (!exitPathAvailable(normalizedName)) return null;
  const canRoute = walkingRouteAvailable(normalizedName);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="bg-background border-border rounded-md border px-2 py-1 text-xs shadow-sm">
        {snipNote}
      </span>
      {summary !== null ? (
        <span
          className="bg-background border-border max-w-[30rem] truncate rounded-md border px-3 py-1.5 text-base shadow-sm"
          title={`${summary} A walking estimate around buildings, fences and water.`}
        >
          {parts !== null ? (
            <>
              <span className="font-semibold underline decoration-1 underline-offset-2">
                {parts.name}
              </span>
              {parts.how}:{" "}
              <span className="font-bold text-red-600 dark:text-red-500">{parts.distance}</span>,{" "}
              <span className="font-bold text-blue-600 dark:text-sky-400">{parts.time}</span>
            </>
          ) : (
            summary
          )}
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-pressed={showAll}
        onClick={() => {
          if (!showAll) ensureMarkerView();
          setShowAll(!showAll);
        }}
        title="Show every exit on this map"
        className={toggleClass(showAll)}
      >
        Show all exits
      </Button>
      {canRoute ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={pathOn}
          onClick={() => {
            if (pathOn) clearSelection();
            else ensureMarkerView();
            setPathOn(!pathOn);
          }}
          title="Walking path to the exit you clicked, else the closest available one."
          className={toggleClass(pathOn)}
        >
          Go to Exit
        </Button>
      ) : null}
    </div>
  );
}
