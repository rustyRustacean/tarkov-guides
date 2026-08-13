"use client";

import { useMemo } from "react";

import { buildItemIndexes, buildTaskIndex } from "./indexes";
import { useTarkovGameData } from "./use-tarkov-game-data";

import type { ItemIndexes } from "./indexes";
import type { NormalizedTask } from "./types";

export interface TarkovIndexes {
  items: ItemIndexes;
  tasksById: ReadonlyMap<string, NormalizedTask>;
}

/**
 * `buildItemIndexes`/`buildTaskIndex` (`indexes.ts`), memoized on
 * `useTarkovGameData()`'s own data reference so every component consuming
 * this hook during the same fetch shares one build instead of each
 * independently re-deriving its own `itemsById`/`tasksById` on mount. 8
 * components were each hand-rolling this exact
 * `new Map(items.map(...))`/`new Map(tasks.map(...))` pattern: real,
 * repeated allocation over the live catalog (~5,000 items) and task list
 * (~510 tasks) that this hook replaces.
 *
 * Deliberately does NOT cover every existing id-map in the codebase: a few
 * sites build their own `tasksById`/`itemsById` **inside a pure selector
 * function** (`getQuestAvailability`, `getTrackedItems`,
 * `computeQuestTreeLayout`) rather than at the React-component level; those
 * are a different situation (an algorithm's own internal working data,
 * already properly scoped by their caller's own memoization) and aren't
 * migrated here; only the render-path duplicates are.
 */
export function useTarkovIndexes(): TarkovIndexes {
  const { data } = useTarkovGameData();
  const items = data?.items;
  const tasks = data?.tasks;

  const itemIndexes = useMemo(() => buildItemIndexes(items ?? []), [items]);
  const tasksById = useMemo(() => buildTaskIndex(tasks ?? []), [tasks]);

  return { items: itemIndexes, tasksById };
}
