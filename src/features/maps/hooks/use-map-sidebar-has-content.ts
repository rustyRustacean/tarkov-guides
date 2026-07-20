"use client";

import { useActiveFaction } from "@/features/progress-tracker/hooks/use-active-faction";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { getMapTrackedItems } from "../lib/map-sidebar-items";
import { getDefaultMapTasks } from "../lib/map-sidebar-tasks";

/**
 * Whether the given map has anything to show in the sidebar's default
 * (non-search) Items or Tasks pane for the active profile - mirrors the
 * exact same `getMapTrackedItems`/`getDefaultMapTasks` computations
 * `MapSidebar`/`MapSidebarTasks` already run, so "empty" here means those
 * panes would render nothing but their own empty-state message. `undefined`
 * while game data or profile progress hasn't loaded yet - callers should
 * treat that as "not yet known" rather than "empty", so a fresh page load
 * doesn't collapse the panel before it's had a chance to find real content.
 */
export function useMapSidebarHasContent(normalizedName: string): boolean | undefined {
  const { data } = useTarkovGameData();

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useProgressTrackerStore((state) =>
    activeProfileId !== null ? state.progressByProfile[activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();

  if (!data || !progress || activeFaction === undefined) return undefined;

  const itemRows = getMapTrackedItems(data.tasks, data.items, progress, normalizedName);
  if (itemRows.length > 0) return true;

  const { mapSpecific, anyMap } = getDefaultMapTasks(
    data.tasks,
    normalizedName,
    progress,
    activeFaction,
  );
  return mapSpecific.length > 0 || anyMap.length > 0;
}
