"use client";

import { useMemo } from "react";

import { buildTaskIndex } from "@/shared/lib/tarkov-api/indexes";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useProgressTrackerStore } from "../store";

import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface ActiveModeTasks {
  tasks: readonly NormalizedTask[] | undefined;
  /** Shares one build per fetch+mode across every consumer on the page, same motivation as `useTarkovIndexes()`. */
  tasksById: ReadonlyMap<string, NormalizedTask>;
  /**
   * `false` when the active mode is Seasonal PvP: tarkov.dev has no
   * Seasonal-tagged task feed, so `tasks`/`tasksById` above transparently
   * fall back to the regular/PvP list. Callers showing task content for the
   * active mode should surface this (e.g. a "not verified for Season yet"
   * note) rather than presenting the borrowed PvP data as confirmed
   * Seasonal content.
   */
  isAccurateForMode: boolean;
}

/**
 * The task list (and its id-lookup index) for the CURRENTLY ACTIVE game
 * mode: PvE reads `TarkovGameData.tasksPve`, PvP and Season both read
 * `TarkovGameData.tasks`. This is the one place that resolves which of
 * `tasks`/`tasksPve` the active mode means; every task-consuming surface in
 * Progress Tracker/Maps should read through this instead of
 * `useTarkovGameData().data?.tasks` directly, so a future consumer can't
 * forget the mode branch and silently show PvP tasks while PvE (or a
 * genuine future Seasonal feed) is active.
 */
export function useActiveModeTasks(): ActiveModeTasks {
  const { data } = useTarkovGameData();
  const activeMode = useProgressTrackerStore((state) => state.activeMode);
  const tasks = activeMode === "PVE" ? data?.tasksPve : data?.tasks;
  const tasksById = useMemo(() => buildTaskIndex(tasks ?? []), [tasks]);
  return { tasks, tasksById, isAccurateForMode: activeMode !== "PVP_SEASONAL" };
}
