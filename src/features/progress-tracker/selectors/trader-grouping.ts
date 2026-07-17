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
 * `trader.name` values) - ported verbatim (order) from legacy's
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
 * Per-trader outline color for `QuestTreeView`'s node boxes, as a CSS
 * `var(--color-status-*)` reference (not a Tailwind class name - the `-2`
 * suffixed tokens like `--color-status-red-2` have no other consumer yet in
 * this codebase to confirm Tailwind v4 actually generates an `outline-*`
 * utility for them, so this reads the custom property directly via inline
 * `style`, which works unconditionally).
 *
 * Only 6 truly distinct hues exist across every theme (amber/teal/violet/
 * green/red/kappa - `primary`/`--accent` is deliberately excluded since it
 * equals `--amber` exactly in the Inventory Grid theme, which would make a
 * trader-outline indistinguishable from the "available" status color there)
 * for 11 traders, so the last 4 reuse a `-2` (lighter) variant of an
 * already-used hue, and Lightkeeper (a single very-late-game quest chain)
 * reuses Peacekeeper's violet outright - the legend's trader *name* label
 * disambiguates regardless of any near-duplicate hue.
 */
const TRADER_OUTLINE_COLOR_VAR: Readonly<Record<string, string>> = {
  prapor: "var(--color-status-red)",
  therapist: "var(--color-status-green)",
  skier: "var(--color-status-kappa)",
  peacekeeper: "var(--color-status-violet)",
  mechanic: "var(--color-status-amber)",
  ragman: "var(--color-status-teal)",
  jaeger: "var(--color-status-red-2)",
  fence: "var(--color-status-green-2)",
  ref: "var(--color-status-teal-2)",
  "btr driver": "var(--color-status-amber-2)",
  lightkeeper: "var(--color-status-violet)",
};

/** `trader.name` (any casing) → outline color CSS `var()` reference for `QuestTreeView`'s node boxes. Falls back to a neutral border color for any trader outside the known roster. */
export function getTraderOutlineColor(traderName: string): string {
  return TRADER_OUTLINE_COLOR_VAR[traderName.toLowerCase()] ?? "var(--color-border)";
}

/** `TRADER_ROSTER` paired with its outline color, in canonical roster order - for `QuestTreeView`'s legend. */
export const TRADER_OUTLINE_LEGEND: readonly { name: string; colorVar: string }[] =
  TRADER_ROSTER.map((name) => ({ name, colorVar: getTraderOutlineColor(name) }));

/**
 * Groups tasks by `trader.name` (tarkov.dev's task query exposes no trader
 * id-based grouping key beyond the name - confirmed via
 * `src/shared/lib/tarkov-api/types.ts`). `trader` is confirmed `NON_NULL` on
 * the live tarkov.dev schema (2026-07-16 audit), so every task has a real
 * trader - no "Unknown" fallback bucket is needed.
 *
 * Sort within each trader group: pinned tasks first, then by status bucket
 * `{inprog, notstarted, failed, done}` - matching confirmed legacy behavior
 * in `old/TarkovTrackerWB-main/src/components/traders/traders.js`. There is
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
