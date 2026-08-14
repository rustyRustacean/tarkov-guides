"use client";

import { useState } from "react";
import { Polyline } from "react-leaflet";

import { QuestDetailDialog } from "@/features/progress-tracker/components/QuestDetailDialog";
import { useActiveModeTasks } from "@/features/progress-tracker/hooks/use-active-mode-tasks";
import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { gameCenter, type VariantCalibration } from "../lib/leaflet-crs";
import { getTaskMarkersForMap, type TaskMarker as TaskMarkerData } from "../lib/task-markers";
import { useSoloTaskStore } from "../solo-task-store";
import { useMapsStore } from "../store";

import { SoloTaskOnMapControls } from "./SoloTaskOnMapControls";
import { TaskMarker } from "./TaskMarker";

import type { TaskStatus } from "@/features/progress-tracker/types";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  normalizedMapName: string;
  /** Present only for a manually-calibrated 2D/3D variant: markers project through its affine instead of the default `[z, x]` game-space placement. */
  calibration?: VariantCalibration | undefined;
  /** The bounds the calibrated variant's image is drawn against (its contain-fit rectangle), the same reference the affine's fractional output maps into. */
  imageBounds?: LatLngBoundsExpression | undefined;
}

/**
 * A distinct hue per task link. Spread by the golden-ratio conjugate so the
 * sequence is low-discrepancy (adjacent tasks never share a shade and it never
 * ambiguously reuses one until it has to), and confined to 40deg-330deg so it
 * never lands on the draw tool's red (`#ff3b3b`, hue ~0): connector lines must
 * stay clearly distinct from a user's own red drawings.
 */
const LINK_HUE_MIN = 40;
const LINK_HUE_SPAN = 290; // 40deg..330deg, skipping the 330->40 red band
function hueForIndex(index: number): number {
  const golden = 0.618033988749895;
  const frac = (index * golden) % 1;
  return LINK_HUE_MIN + frac * LINK_HUE_SPAN;
}

function groupByTask(markers: readonly TaskMarkerData[]): Map<string, TaskMarkerData[]> {
  const groups = new Map<string, TaskMarkerData[]>();
  for (const marker of markers) {
    const existing = groups.get(marker.taskId);
    if (existing) existing.push(marker);
    else groups.set(marker.taskId, [marker]);
  }
  return groups;
}

/**
 * Renders every quest-objective marker for the current map, plus optional
 * "show links" (polylines connecting a multi-point task's markers) and
 * click-to-open task detail (reusing Progress Tracker's
 * `QuestDetailDialog` directly rather than building a second task-detail
 * surface). Self-contained: reads live game data, the active profile's
 * task statuses, and this feature's own per-profile display overrides
 * itself, matching this project's established "feature panel reads its own
 * data" convention (e.g. `HideoutTracker`/`KappaTracker`).
 */
export function TaskMarkersLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const { tasks: activeModeTasks } = useActiveModeTasks();
  const tasks = activeModeTasks ?? [];

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useActiveProgress();
  const mapProfileState = useMapsStore((state) =>
    activeProfileId !== null ? state.profileState[activeProfileId] : undefined,
  );
  const showTaskMarkers = useMapsStore((state) => state.showTaskMarkers);
  const showTaskLinks = useMapsStore((state) => state.showTaskLinks);
  const showTaskNames = useMapsStore((state) => state.showTaskNames);
  const soloTaskId = useSoloTaskStore((state) => state.soloTaskId);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (!showTaskMarkers || !progress) return null;

  const taskStatus: Record<string, TaskStatus | undefined> = {};
  for (const [taskId, entry] of Object.entries(progress.taskStatus)) {
    taskStatus[taskId] = entry.status;
  }

  const allMarkers = getTaskMarkersForMap(
    tasks,
    normalizedMapName,
    taskStatus,
    mapProfileState?.taskDisplayOverrides ?? {},
  );

  // Solo mode (`SoloTaskOnMapControls`) narrows the map to a single task's
  // markers. Filtered here rather than inside `getTaskMarkersForMap` because
  // it is a transient view filter, not part of which tasks *belong* on this
  // map: the sidebar list, which shares that function, deliberately keeps
  // showing everything.
  const markers =
    soloTaskId === null ? allMarkers : allMarkers.filter((m) => m.taskId === soloTaskId);

  // The one shared projection (see `gameCenter`): the same call the player
  // dot goes through, so a task pin and a player position with the same
  // coordinates always land on the same pixel.
  function centerFor(marker: TaskMarkerData): [number, number] {
    return gameCenter(marker.x, marker.z, calibration, imageBounds);
  }

  return (
    <>
      {showTaskLinks &&
        Array.from(groupByTask(markers).entries()).map(([taskId, taskMarkers], index) =>
          taskMarkers.length > 1 ? (
            <Polyline
              key={taskId}
              positions={taskMarkers.map((marker) => centerFor(marker))}
              color={`hsl(${String(hueForIndex(index))}, 70%, 58%)`}
              weight={2.5}
              opacity={0.85}
              // Dotted (round-capped) so a connector never reads as one of the
              // user's own solid drawn strokes.
              dashArray="1 7"
              lineCap="round"
            />
          ) : null,
        )}
      {markers.map((marker) => (
        <TaskMarker
          key={`${marker.taskId}:${marker.objectiveId}`}
          marker={marker}
          center={centerFor(marker)}
          onSelect={setSelectedTaskId}
          showName={showTaskNames}
        />
      ))}
      <QuestDetailDialog
        taskId={selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
        onSelectTask={setSelectedTaskId}
        actions={selectedTaskId ? <SoloTaskOnMapControls taskId={selectedTaskId} /> : undefined}
      />
    </>
  );
}
