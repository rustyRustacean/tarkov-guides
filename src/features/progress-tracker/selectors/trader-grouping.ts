import type { ProfileProgress, TaskStatus } from "../types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

const STATUS_SORT_ORDER: Record<TaskStatus, number> = {
  inprog: 0,
  notstarted: 1,
  failed: 2,
  done: 3,
};

/**
 * Canonical in-game trader roster, proper-cased (matches tarkov.dev's real
 * `trader.name` values), ported verbatim (order) from legacy's
 * `TRADER_ORDER`/`traderOrderCmp` in
 * `old/TarkovTrackerWB-main/src/components/hideout/hideoutGoal.js`. The
 * single source of truth for both `TRADER_DISPLAY_ORDER` (sort order) and
 * `TRADER_OUTLINE_LEGEND` (`QuestTreeView`'s per-trader node outline colors)
 * below, so the two can never drift apart.
 */
const TRADER_ROSTER = [
  "Prapor",
  "Therapist",
  "Skier",
  "Peacekeeper",
  "Mechanic",
  "Ragman",
  "Jaeger",
  "Fence",
  "Ref",
  "BTR Driver",
  "Lightkeeper",
] as const;

const TRADER_DISPLAY_ORDER = TRADER_ROSTER.map((name) => name.toLowerCase());

/**
 * Per-trader outline color for `QuestTreeView`'s node boxes (and the
 * Analytics tab's remaining-tasks-by-trader pie chart), as a CSS
 * `var(--color-trader-*)` reference (not a Tailwind class name: reads the
 * custom property directly via inline `style`, which works unconditionally).
 *
 * `--color-trader-*` is a dedicated 11-hue categorical palette (see
 * `globals.css`'s "trader-" block), physically separate from the 6-hue
 * `--color-status-*` palette that encodes task *state*
 * (done/available/locked/failed). This used to borrow from `status-*`
 * instead: with only 6 status hues for 11 traders, 5 traders fell back to
 * a lighter `-2` tint of an already-used hue (e.g. amber vs amber-2 both
 * read as "yellow"), and Lightkeeper duplicated Peacekeeper's violet
 * outright, which read as literal duplicate colors rather than merely an
 * imperfect CVD-safety tradeoff. Each trader gets its own hue now; the
 * legend's trader *name* label is still the real disambiguator (11
 * categories can't be made pairwise colorblind-safe, see the `dataviz`
 * skill's `color-formula.md`), so hue does its best-effort job, the label
 * does the rest, same as before.
 */
const TRADER_OUTLINE_COLOR_VAR: Readonly<Record<string, string>> = {
  prapor: "var(--color-trader-red)",
  jaeger: "var(--color-trader-orange)",
  mechanic: "var(--color-trader-amber)",
  "btr driver": "var(--color-trader-lime)",
  therapist: "var(--color-trader-green)",
  fence: "var(--color-trader-teal)",
  ragman: "var(--color-trader-cyan)",
  ref: "var(--color-trader-blue)",
  lightkeeper: "var(--color-trader-indigo)",
  peacekeeper: "var(--color-trader-violet)",
  skier: "var(--color-trader-pink)",
};

/** `trader.name` (any casing) → outline color CSS `var()` reference for `QuestTreeView`'s node boxes. Falls back to a neutral border color for any trader outside the known roster. */
export function getTraderOutlineColor(traderName: string): string {
  return TRADER_OUTLINE_COLOR_VAR[traderName.toLowerCase()] ?? "var(--color-border)";
}

/** `TRADER_ROSTER` paired with its outline color, in canonical roster order, for `QuestTreeView`'s legend. */
export const TRADER_OUTLINE_LEGEND: readonly { name: string; colorVar: string }[] =
  TRADER_ROSTER.map((name) => ({ name, colorVar: getTraderOutlineColor(name) }));

/**
 * Groups tasks by `trader.name` (tarkov.dev's task query exposes no trader
 * id-based grouping key beyond the name; see
 * `src/shared/lib/tarkov-api/types.ts`). `trader` is `NON_NULL` on the live
 * tarkov.dev schema, so every task has a real trader: no "Unknown" fallback
 * bucket is needed.
 *
 * Sort within each trader group: pinned tasks first, then by status bucket
 * `{inprog, notstarted, failed, done}`, matching legacy behavior in
 * `old/TarkovTrackerWB-main/src/components/traders/traders.js`. There is
 * deliberately no "locked" bucket: locked/available is never a stored
 * status (see `selectors/quest-availability.ts`), only `notstarted` is.
 */
export function groupTasksByTrader(
  tasks: readonly NormalizedTask[],
  progress: ProfileProgress,
): ReadonlyMap<string, readonly NormalizedTask[]> {
  const groups = new Map<string, NormalizedTask[]>();
  for (const task of tasks) {
    const traderName = task.trader.name;
    const group = groups.get(traderName);
    if (group) {
      group.push(task);
    } else {
      groups.set(traderName, [task]);
    }
  }

  const pinnedTaskIds = new Set(progress.pinnedTaskIds);
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const aPinned = pinnedTaskIds.has(a.id);
      const bPinned = pinnedTaskIds.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const aStatus = progress.taskStatus[a.id]?.status ?? "notstarted";
      const bStatus = progress.taskStatus[b.id]?.status ?? "notstarted";
      return STATUS_SORT_ORDER[aStatus] - STATUS_SORT_ORDER[bStatus];
    });
  }

  return groups;
}

/**
 * Sorts trader names into canonical in-game roster order (`TRADER_DISPLAY_ORDER`),
 * for use as `TraderTaskBoard`'s section order. Unknown trader names (including
 * `"Unknown"` itself) sink to the end, alphabetically among themselves.
 */
export function sortTraderNames(names: readonly string[]): string[] {
  const rank = (name: string): number => {
    const index = TRADER_DISPLAY_ORDER.indexOf(name.toLowerCase());
    return index === -1 ? TRADER_DISPLAY_ORDER.length : index;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
