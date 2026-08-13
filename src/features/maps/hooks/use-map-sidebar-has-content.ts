"use client";

import { useActiveFaction } from "@/features/progress-tracker/hooks/use-active-faction";
import { useActiveModeTasks } from "@/features/progress-tracker/hooks/use-active-mode-tasks";
import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { getMapTrackedItems } from "../lib/map-sidebar-items";
import { getDefaultMapTasks } from "../lib/map-sidebar-tasks";

/**
 * Whether the given map has anything to show in the sidebar's default
 * (non-search) Items or Tasks pane for the active profile. Mirrors the same
 * `getMapTrackedItems`/`getDefaultMapTasks` computations `MapSidebar`/
 * `MapSidebarTasks` already run, so "empty" here means those panes would
 * render nothing but their own empty-state message.
 *
 * Returns `undefined` while game data or profile progress hasn't loaded,
 * so callers can treat that as "not yet known" rather than "empty" and
 * avoid collapsing the panel before it's had a chance to find real content.
 * A user with no active profile resolves straight to `false` instead of
 * staying `undefined` forever, since with no profile those panes only ever
 * render a plain empty-state message with nothing worth keeping the panel
 * open for.
 */
export function useMapSidebarHasContent(normalizedName: string): boolean | undefined {
  const { data } = useTarkovGameData();
  const { tasks } = useActiveModeTasks();

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();

  if (activeProfileId === null) return false;
  if (!data || !tasks || !progress || activeFaction === undefined) return undefined;

  const itemRows = getMapTrackedItems(tasks, data.items, progress, normalizedName);
  if (itemRows.length > 0) return true;

  const { mapSpecific, anyMap } = getDefaultMapTasks(
    tasks,
    normalizedName,
    progress,
    activeFaction,
  );
  return mapSpecific.length > 0 || anyMap.length > 0;
}
