/**
 * Hand-verified corrections to a task's `minPlayerLevel` and/or
 * `taskRequirements` (prerequisites), for cases where tarkov.dev's API value
 * has been checked against the game and confirmed wrong.
 *
 * Applied in `normalizeTask` (`normalize-task.ts`): when present, an entry's
 * `minPlayerLevel` and/or `taskRequirements` fully replace the API's own
 * value for that field (never merged), since a correction found for one
 * field doesn't imply anything about the other.
 *
 * Entries are keyed by task id, with the task name as a trailing comment for
 * human reviewability (same convention as `loyalty-board-overrides.ts`).
 *
 * Only add an entry with evidence from the game itself (a player's real quest
 * state, or the game's own data). The wiki is not enough: see below.
 */
export interface TaskCorrectionOverride {
  minPlayerLevel?: number;
  taskRequirements?: readonly { taskId: string; status: readonly string[] }[];
}

/**
 * Intentionally empty. The 110 prerequisite entries added on 2026-09-07 came
 * from the wiki's "previous quest" fields and were removed on 2026-11-07.
 *
 * Patch 1.1.0.0 (2026-08-03, Season 1 task rework) replaced most long quest
 * chains with trader loyalty level gates, so the wiki's old chains are
 * legacy and tarkov.dev's empty `taskRequirements` are the rework itself, not
 * a parsing gap. Checked 2026-11-07 against `json.tarkov.dev/regular/tasks`
 * and a real companion `/status`:
 * - 104 of the 110 entries added a prerequisite where the API lists none.
 * - The other 6 replaced a requirement the API still lists (the Survivalist
 *   Path, Surprise Gift, Decisions Decisions and Professional Fitness
 *   chains). Each API value is part of a connected chain, and where the real
 *   state has evidence it agrees with the API: Unprotected but Dangerous
 *   `started` with its API prerequisite Zhivchik `finished`, and
 *   Professional Fitness - Part 1 `finished` with its API prerequisite Arena
 *   Business `started`.
 * - 28 prerequisite pairs contradicted the real state outright: a task was
 *   `finished` or `started` while its overridden prerequisite was only
 *   `started` (e.g. Revision - Lighthouse `finished`, Revision - Reserve
 *   `started`), and the prerequisite cascade then marked the prerequisite
 *   done.
 */
export const TASK_CORRECTIONS_OVERRIDES: Readonly<Record<string, TaskCorrectionOverride>> = {};
