"use client";

import { CircleMarker, Tooltip } from "react-leaflet";

import type { TaskMarker as TaskMarkerData } from "../lib/task-markers";

interface Props {
  marker: TaskMarkerData;
  onSelect: (taskId: string) => void;
  /** Shows a permanent name label above the dot instead of only on hover - legacy's "show names" mode. */
  showName?: boolean;
}

/**
 * One quest-objective pin. Ported from legacy's `renderLeafletMarkers`
 * (`wiki.js`) - a single visible circle rather than the legacy's separate
 * invisible-hit-radius + visible-dot pair (`CircleMarker`'s own hit area is
 * already larger than its drawn radius, so a second circle isn't needed).
 * Hover shows task/objective context via react-leaflet's own `Tooltip`
 * (a Leaflet-native layer tooltip, not this project's Radix-based
 * `shared/ui/tooltip` - that one requires a real DOM ref to attach to,
 * which a Leaflet canvas/SVG layer doesn't expose the same way). Click
 * opens the shared `QuestDetailDialog` (reused from Progress Tracker) via
 * the `onSelect` callback.
 */
export function TaskMarker({ marker, onSelect, showName = false }: Props) {
  return (
    <CircleMarker
      center={[marker.z, marker.x]}
      radius={7}
      weight={2}
      color="#0a0a0a"
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
            <p className="text-sm font-semibold">{marker.taskName}</p>
            <p className="text-muted-foreground mt-1 text-xs">{marker.objectiveDescription}</p>
          </div>
        </Tooltip>
      )}
    </CircleMarker>
  );
}
