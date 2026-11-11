"use client";

import { useMemo } from "react";

import { buildTaskIndex } from "@/shared/lib/tarkov-api/indexes";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useProgressTrackerStore } from "../store";

import type { ProfileMode } from "../types";
import type { NormalizedTask, TarkovGameData } from "@/shared/lib/tarkov-api/types";

export interface ActiveModeTasks {
  tasks: readonly NormalizedTask[] | undefined;
  /** Shares one build per fetch+mode across every consumer on the page, same motivation as `useTarkovIndexes()`. */
  tasksById: ReadonlyMap<string, NormalizedTask>;
}

/** The task list tarkov.dev publishes for each game mode the tracker models. */
export function tasksForMode(data: TarkovGameData, mode: ProfileMode): readonly NormalizedTask[] {
  switch (mode) {
    case "PVE":
      return data.tasksPve;
    case "PVP_SEASONAL":
      return data.tasksSeason;
    case "PVP":
      return data.tasks;
  }
}

/**
 * The task list (and its id-lookup index) for the CURRENTLY ACTIVE game
 * mode: PvP reads `TarkovGameData.tasks`, PvE `tasksPve`, and Seasonal
 * `tasksSeason`. This is the one place that resolves which list the active
 * mode means; every task-consuming surface in Progress Tracker/Maps should
 * read through this instead of `useTarkovGameData().data?.tasks` directly,
 * so a future consumer can't forget the mode branch and silently show PvP
 * tasks while another mode is active.
 */
export function useActiveModeTasks(): ActiveModeTasks {
  const { data } = useTarkovGameData();
  const activeMode = useProgressTrackerStore((state) => state.activeMode);
  const tasks = data ? tasksForMode(data, activeMode) : undefined;
  const tasksById = useMemo(() => buildTaskIndex(tasks ?? []), [tasks]);
  return { tasks, tasksById };
}
