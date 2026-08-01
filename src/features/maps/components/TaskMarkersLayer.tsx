"use client";

import { useState } from "react";
import { Polyline } from "react-leaflet";

import { QuestDetailDialog } from "@/features/progress-tracker/components/QuestDetailDialog";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { calibratedLatLng, type VariantCalibration } from "../lib/leaflet-crs";
import { getTaskMarkersForMap, type TaskMarker as TaskMarkerData } from "../lib/task-markers";
import { useMapsStore } from "../store";

import { TaskMarker } from "./TaskMarker";

import type { TaskStatus } from "@/features/progress-tracker/types";
import type { LatLngBoundsExpression } from "leaflet";

interface Props {
  normalizedMapName: string;
  /** Present only for a manually-calibrated 2D/3D variant - markers project through its affine instead of the default `[z, x]` game-space placement. */
  calibration?: VariantCalibration | undefined;
  /** The bounds the calibrated variant's image is drawn against (its contain-fit rectangle) - the same reference the affine's fractional output maps into. */
  imageBounds?: LatLngBoundsExpression | undefined;
}

/** Golden-angle hue stepping so overlapping quest paths stay visually distinguishable - ported from legacy's `_renderLeafletTaskLinks` (`wiki.js`). */
function hueForIndex(index: number): number {
  return (index * 137.508) % 360;
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
 * surface). Self-contained - reads live game data, the active profile's
 * task statuses, and this feature's own per-profile display overrides
 * itself, matching this project's established "feature panel reads its own
 * data" convention (e.g. `HideoutTracker`/`KappaTracker`).
 */
export function TaskMarkersLayer({ normalizedMapName, calibration, imageBounds }: Props) {
  const { data } = useTarkovGameData();
  const tasks = data?.tasks ?? [];

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useProgressTrackerStore((state) =>
    activeProfileId !== null ? state.progressByProfile[activeProfileId] : undefined,
  );
  const mapProfileState = useMapsStore((state) =>
    activeProfileId !== null ? state.profileState[activeProfileId] : undefined,
  );
  const showTaskMarkers = useMapsStore((state) => state.showTaskMarkers);
  const showTaskLinks = useMapsStore((state) => state.showTaskLinks);
  const showTaskNames = useMapsStore((state) => state.showTaskNames);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (!showTaskMarkers || !progress) return null;

  const taskStatus: Record<string, TaskStatus | undefined> = {};
  for (const [taskId, entry] of Object.entries(progress.taskStatus)) {
    taskStatus[taskId] = entry.status;
  }

  const markers = getTaskMarkersForMap(
    tasks,
    normalizedMapName,
    taskStatus,
    mapProfileState?.taskDisplayOverrides ?? {},
  );

  // Calibrated variants place a marker via their affine (game -> image
  // fractional) onto the image's own bounds; every other variant uses the
  // map's shared game-space CRS directly (`[z, x]`), unchanged.
  function centerFor(marker: TaskMarkerData): [number, number] {
    if (calibration && imageBounds) {
      const latLng = calibratedLatLng(calibration, marker.x, marker.z, imageBounds);
      return [latLng.lat, latLng.lng];
    }
    return [marker.z, marker.x];
  }

  return (
    <>
      {showTaskLinks &&
        Array.from(groupByTask(markers).entries()).map(([taskId, taskMarkers], index) =>
          taskMarkers.length > 1 ? (
            <Polyline
              key={taskId}
              positions={taskMarkers.map((marker) => centerFor(marker))}
              color={`hsl(${String(hueForIndex(index))}, 70%, 55%)`}
              weight={2}
              opacity={0.7}
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
      />
    </>
  );
}
