"use client";

import { Fragment, useEffect } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";

import { preloadImage } from "@/shared/lib/preload-image";

import type { TaskMarker as TaskMarkerData } from "../lib/task-markers";

/** Ring color for a "show on map" (forced, not-active) marker: a clear blue, distinct from the gold active-task dot. */
const FORCED_RING_COLOR = "#4a90d9";

interface Props {
  marker: TaskMarkerData;
  /** Leaflet `[lat, lng]` for this marker, computed by the caller so calibrated variants can override the default `[z, x]` game-space placement. */
  center: [number, number];
  onSelect: (taskId: string) => void;
  /** Shows a permanent name label above the dot instead of only on hover; legacy's "show names" mode. */
  showName?: boolean;
}

/**
 * One quest-objective pin. Ported from legacy's `renderLeafletMarkers`
 * (`wiki.js`) as a single visible circle rather than legacy's separate
 * invisible-hit-radius + visible-dot pair (`CircleMarker`'s own hit area is
 * already larger than its drawn radius, so a second circle isn't needed).
 * Hover shows task/objective context via react-leaflet's own `Tooltip`
 * (a Leaflet-native layer tooltip, not this project's Radix-based
 * `shared/ui/tooltip`, which requires a real DOM ref to attach to that a
 * Leaflet canvas/SVG layer doesn't expose the same way). Click opens the
 * shared `QuestDetailDialog` (reused from Progress Tracker) via the
 * `onSelect` callback.
 */
export function TaskMarker({ marker, center, onSelect, showName = false }: Props) {
  // Warm the banner image while the pin is on the map, so the hover tooltip
  // shows it instantly instead of fetching on first hover.
  useEffect(() => {
    preloadImage(marker.taskImageLink);
  }, [marker.taskImageLink]);

  return (
    <Fragment>
      {/* A "show on map" (not-active) marker gets a non-interactive blue halo
          ring behind the dot, so it reads as watched-not-mine at a glance. */}
      {marker.forced && (
        <CircleMarker
          center={center}
          radius={11}
          weight={2}
          color={FORCED_RING_COLOR}
          fillOpacity={0}
          interactive={false}
        />
      )}
      <CircleMarker
        center={center}
        radius={7}
        weight={2}
        color={marker.forced ? FORCED_RING_COLOR : "#0a0a0a"}
        fillColor="#d4a548"
        fillOpacity={1}
        eventHandlers={{
          click: () => {
            onSelect(marker.taskId);
          },
        }}
      >
        {showName ? (
          <Tooltip direction="top" offset={[0, -8]} permanent>
            {marker.taskName}
          </Tooltip>
        ) : (
          <Tooltip direction="top" offset={[0, -8]}>
            <div className="max-w-56">
              {marker.taskImageLink && (
                // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted banner, not a local/optimizable asset.
                <img
                  src={marker.taskImageLink}
                  alt=""
                  className="mb-1.5 block aspect-video w-full rounded object-cover"
                  // If the banner fails to load, collapse it instead of leaving
                  // an empty white box in the preview.
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
              <p className="text-sm font-semibold">{marker.taskName}</p>
              <p className="text-muted-foreground mt-1 text-xs">{marker.objectiveDescription}</p>
            </div>
          </Tooltip>
        )}
      </CircleMarker>
    </Fragment>
  );
}
