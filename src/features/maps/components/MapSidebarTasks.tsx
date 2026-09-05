"use client";

import { useState } from "react";

import { QuestDetailDialog } from "@/features/progress-tracker/components/QuestDetailDialog";
import { useActiveFaction } from "@/features/progress-tracker/hooks/use-active-faction";
import { useActiveModeTasks } from "@/features/progress-tracker/hooks/use-active-mode-tasks";
import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { useTaskActions } from "@/features/progress-tracker/hooks/use-task-actions";
import { getTraderOutlineColor } from "@/features/progress-tracker/selectors/trader-grouping";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";

import { firstOtherMap, getDefaultMapTasks, searchTasks } from "../lib/map-sidebar-tasks";
import { isForcedTaskDisplay, shouldDisplayTaskOnMap } from "../lib/task-markers";
import { useMapsStore } from "../store";

import { SoloTaskOnMapControls } from "./SoloTaskOnMapControls";

import type { ProfileProgress, TaskStatus } from "@/features/progress-tracker/types";
import type { NormalizedTask, RawMap } from "@/shared/lib/tarkov-api/types";

function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

function humanizeMapName(normalizedName: string): string {
  return normalizedName.split("-").map(capitalize).join(" ");
}

function displayMapName(normalizedName: string, maps: readonly RawMap[]): string {
  return (
    maps.find((m) => m.normalizedName === normalizedName)?.name ?? humanizeMapName(normalizedName)
  );
}

interface RowProps {
  task: NormalizedTask;
  status: TaskStatus;
  pinned: boolean;
  displayOn: boolean;
  /** Shown on the map only via a manual "show on map" toggle while not active: gets a distinct blue highlight + badge. */
  forced: boolean;
  /** Trader name (upper-cased for display), colored to match the Progress Tracker's per-trader color. */
  traderName: string;
  /** CSS `var()` color reference for this task's trader, shared with the Progress Tracker via `getTraderOutlineColor`. */
  traderColor: string;
  /** The map(s) this task is on, or "ANY MAP"; shown after the trader name. */
  mapText: string;
  goToMapLabel: string | null;
  onGoToMap: (() => void) | null;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleDisplay: () => void;
  onStart: () => void;
  onDone: () => void;
  onFail: () => void;
  onUnstart: () => void;
  onUndo: () => void;
}

function TaskSidebarRow({
  task,
  status,
  pinned,
  displayOn,
  forced,
  traderName,
  traderColor,
  mapText,
  goToMapLabel,
  onGoToMap,
  onOpen,
  onTogglePin,
  onToggleDisplay,
  onStart,
  onDone,
  onFail,
  onUnstart,
  onUndo,
}: RowProps) {
  return (
    <li
      className={
        forced
          ? "border-status-blue bg-status-blue/10 flex flex-col gap-2 rounded-md border-2 p-3 text-sm"
          : "border-border bg-popover flex flex-col gap-2 rounded-md border p-3 text-sm"
      }
      // Soft inner glow tinted to the task's trader (same color the Progress
      // Tracker uses), so a card reads as "belonging to" that trader at a
      // glance. Inline because the color is per-trader runtime data; this
      // replaces the utility shadow/ring, so a light outer lift is folded in
      // here too.
      style={{
        boxShadow: `inset 0 0 12px color-mix(in srgb, ${traderColor} 42%, transparent), 0 1px 2px rgb(0 0 0 / 0.14)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          onDoubleClick={onTogglePin}
          className="min-w-0 flex-1 text-left"
          aria-pressed={pinned}
          title="Open task details - double-click to pin/unpin"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">
              {pinned && <span aria-hidden="true">📌 </span>}
              {task.name}
            </span>
            {task.kappaRequired && <Badge variant="kappa">Kappa</Badge>}
            {forced && (
              <Badge
                variant="teal"
                title="On the map via 'show on map' - not one of your active tasks"
              >
                📍 Show on map
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            <span className="font-semibold" style={{ color: traderColor }}>
              {traderName}
            </span>
            {mapText && <> · {mapText}</>}
          </div>
          {goToMapLabel && onGoToMap && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onGoToMap();
              }}
              className="text-primary mt-1 text-xs underline-offset-2 hover:underline"
            >
              → go to {goToMapLabel}
            </button>
          )}
        </button>

        <label
          className="text-muted-foreground flex shrink-0 flex-col items-center gap-0.5 text-center text-[10px]"
          title="Show this quest's markers on the map"
        >
          <input
            type="checkbox"
            checked={displayOn}
            onChange={onToggleDisplay}
            className="accent-primary"
          />
          display
          <br />
          on map
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {status === "notstarted" && (
          <Button type="button" size="sm" onClick={onStart}>
            Start
          </Button>
        )}
        {status === "inprog" && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onUnstart}>
              Unstart
            </Button>
            <Button type="button" size="sm" onClick={onDone}>
              Done
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onFail}>
              Fail
            </Button>
          </>
        )}
        {(status === "failed" || status === "done") && (
          <Button type="button" size="sm" variant="outline" onClick={onUndo}>
            Undo
          </Button>
        )}
      </div>
    </li>
  );
}

function mapLabelFor(task: NormalizedTask, maps: readonly RawMap[]): string {
  return task.maps.length === 0
    ? "ANY MAP"
    : task.maps.map((m) => displayMapName(m, maps)).join(" · ");
}

interface Props {
  normalizedName: string;
  searchQuery: string;
}

/**
 * The sidebar's Tasks pane, ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapSidebar.js`'s `renderMapTasks`. Self-contained (reads
 * live game data, active-profile progress, and Maps' own per-profile task
 * display overrides itself), matching `TaskMarkersLayer`'s established
 * convention. Status actions go through `useTaskActions()`, each already
 * wired to a toast "UNDO" action, so there's no hold-to-confirm gesture.
 */
export function MapSidebarTasks({ normalizedName, searchQuery }: Props) {
  const { data } = useTarkovGameData();
  const { tasks: activeModeTasks } = useActiveModeTasks();
  const tasks = activeModeTasks ?? [];
  const maps = data?.maps ?? [];

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const setCurrentMap = useMapsStore((state) => state.setCurrentMap);
  const setTaskDisplayOverride = useMapsStore((state) => state.setTaskDisplayOverride);
  const mapProfileState = useMapsStore((state) =>
    activeProfileId !== null ? state.profileState[activeProfileId] : undefined,
  );
  const taskDisplayOverrides = mapProfileState?.taskDisplayOverrides ?? {};
  const actions = useTaskActions();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  if (!progress || activeFaction === undefined) {
    return (
      <p className="text-muted-foreground bg-card/90 m-2 rounded-md p-4 text-sm backdrop-blur-sm">
        No active profile.
      </p>
    );
  }

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const searchResults = isSearching ? searchTasks(tasks, trimmedQuery, progress) : [];
  const { mapSpecific, anyMap } = isSearching
    ? { mapSpecific: [] as readonly NormalizedTask[], anyMap: [] as readonly NormalizedTask[] }
    : getDefaultMapTasks(tasks, normalizedName, progress, activeFaction, taskDisplayOverrides);

  function statusOf(taskId: string): TaskStatus {
    return progress ? (progress.taskStatus[taskId]?.status ?? "notstarted") : "notstarted";
  }

  function rowFor(task: NormalizedTask, currentProgress: ProfileProgress) {
    const otherMap = isSearching ? firstOtherMap(task, normalizedName) : null;
    return (
      <TaskSidebarRow
        key={task.id}
        task={task}
        status={statusOf(task.id)}
        pinned={currentProgress.pinnedTaskIds.includes(task.id)}
        displayOn={shouldDisplayTaskOnMap(statusOf(task.id), taskDisplayOverrides[task.id])}
        forced={isForcedTaskDisplay(statusOf(task.id), taskDisplayOverrides[task.id])}
        traderName={task.trader.name.toUpperCase()}
        traderColor={getTraderOutlineColor(task.trader.name)}
        mapText={mapLabelFor(task, maps)}
        goToMapLabel={otherMap ? displayMapName(otherMap, maps) : null}
        onGoToMap={
          otherMap
            ? () => {
                setCurrentMap(otherMap);
              }
            : null
        }
        onOpen={() => {
          setSelectedTaskId(task.id);
        }}
        onTogglePin={() => {
          togglePinnedTask(task.id);
        }}
        onToggleDisplay={() => {
          setTaskDisplayOverride(
            task.id,
            !shouldDisplayTaskOnMap(statusOf(task.id), taskDisplayOverrides[task.id]),
          );
        }}
        onStart={() => {
          actions.startTask(task.id);
        }}
        onDone={() => {
          actions.doneTask(task.id);
        }}
        onFail={() => {
          actions.failTask(task.id);
        }}
        onUnstart={() => {
          actions.unstartTask(task.id);
        }}
        onUndo={() => {
          actions.undoTask(task.id);
        }}
      />
    );
  }

  // Takes the profile explicitly: `progress` is only non-null thanks to the
  // early return above, and that narrowing doesn't reach into a nested
  // function.
  function paneContent(currentProgress: ProfileProgress) {
    if (isSearching) {
      return (
        <>
          <div className="text-muted-foreground bg-card/90 mx-2 mt-2 rounded-md px-2 py-1 text-xs backdrop-blur-sm">
            {searchResults.length} match{searchResults.length === 1 ? "" : "es"} for &ldquo;
            {trimmedQuery}&rdquo;
          </div>
          {searchResults.length === 0 ? (
            <p className="text-muted-foreground bg-card/90 m-2 rounded-md p-4 text-center text-sm backdrop-blur-sm">
              No tasks match
              <br />
              <span className="text-xs">
                try a task name, trader, map, or item · comma = multiple
              </span>
            </p>
          ) : (
            <ul className="flex flex-col gap-2 p-2">
              {searchResults.map((task) => rowFor(task, currentProgress))}
            </ul>
          )}
        </>
      );
    }

    if (mapSpecific.length === 0 && anyMap.length === 0) {
      return (
        <p className="text-muted-foreground bg-card/90 m-2 rounded-md p-4 text-center text-sm backdrop-blur-sm">
          Nothing active on this map
          <br />
          <span className="text-xs">start a task in Traders to see it here</span>
        </p>
      );
    }

    return (
      <ul className="flex flex-col gap-2 p-2">
        {mapSpecific.map((task) => rowFor(task, currentProgress))}
        {mapSpecific.length > 0 && anyMap.length > 0 && (
          <li
            aria-hidden="true"
            className="bg-card/90 flex items-center gap-2 rounded-md px-2 py-1 backdrop-blur-sm"
          >
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
              any map
            </span>
          </li>
        )}
        {anyMap.map((task) => rowFor(task, currentProgress))}
      </ul>
    );
  }

  // The dialog sits outside `paneContent` so it renders whichever pane is
  // showing. It used to live inside the default list, so opening a *search
  // result* set the id with nothing mounted to display it; the task only
  // appeared once the query was cleared and the default list came back.
  return (
    <>
      {paneContent(progress)}
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
