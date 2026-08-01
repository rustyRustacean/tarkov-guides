import { Pin } from "lucide-react";

import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";

import { formatDelayedUnlockEta, formatTraderRequirement } from "../selectors/quest-availability";
import { getTraderOutlineColor } from "../selectors/trader-grouping";

import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";
import type { badgeVariants } from "@/shared/ui/badge/Badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

/**
 * The canonical "why is this locked" status badge - shared with
 * `QuestDetailDialog` (rather than each duplicating this logic, which
 * `QuestDetailDialog` used to do inline) so a locked task always explains
 * itself the same way everywhere it's shown. Faction/Prestige branches
 * added 2026-07-16 (API field-application audit):
 * `QuestAvailability.factionMismatch`/`prestigeUnmet` were already computed
 * by `getQuestAvailability` but had zero UI consumers - a BEAR/USEC-exclusive
 * or Prestige-gated locked task previously showed a bare "Locked" with no
 * explanation, unlike the (already-handled) real-time-delay case below.
 * Prerequisite/trader-requirement branches added in a later audit pass -
 * these are the two MOST COMMON real lock reasons (an unfinished
 * prerequisite quest, or an unmet trader loyalty/reputation requirement),
 * unlike the rarer faction/Prestige/delay cases above them, so most locked
 * quests were still falling through to a bare "Locked" even after the
 * 2026-07-16 fix. Ordered last (after the permanent/absolute faction and
 * Prestige gates, and the deterministic delay gate) since those are more
 * decisively "why," where relevant - a task can be otherwise fully eligible
 * and still show as faction-locked forever, which is more useful to know
 * than "1 prerequisite incomplete" if both happen to apply at once.
 */
export function statusBadge(
  task: NormalizedTask,
  availability: QuestAvailability,
): { label: string; variant: BadgeVariant } {
  switch (availability.status) {
    case "done":
      return { label: "Done", variant: "green" };
    case "failed":
      return { label: "Failed", variant: "red" };
    case "inprog":
      return { label: "In Progress", variant: "teal" };
    default:
      if (availability.isAvailable) return { label: "Available", variant: "amber" };
      if (availability.factionMismatch && task.factionName) {
        return { label: `Locked - ${task.factionName} only`, variant: "outline" };
      }
      if (availability.prestigeUnmet && task.requiredPrestigeLevel !== null) {
        return {
          label: `Locked - requires Prestige ${String(task.requiredPrestigeLevel)}`,
          variant: "outline",
        };
      }
      if (availability.delayedUnlock) {
        return {
          label: `Locked - unlocks in ${formatDelayedUnlockEta(availability.delayedUnlock)}`,
          variant: "outline",
        };
      }
      if (availability.unmetPrereqTaskIds.length > 0) {
        const count = availability.unmetPrereqTaskIds.length;
        return {
          label:
            count === 1
              ? "Locked - 1 prerequisite quest incomplete"
              : `Locked - ${String(count)} prerequisite quests incomplete`,
          variant: "outline",
        };
      }
      const [firstUnmetTraderRequirement] = availability.unmetTraderRequirements;
      if (firstUnmetTraderRequirement) {
        return {
          label: `Locked - ${formatTraderRequirement(firstUnmetTraderRequirement)}`,
          variant: "outline",
        };
      }
      return { label: "Locked", variant: "outline" };
  }
}

/**
 * Row-level status accent, keyed by the same `variant` string
 * `statusBadge()` already returns - reusing that single classification
 * rather than re-deriving status from `availability` a second time.
 * Mirrors `QuestTreeView`'s `STATUS_NODE_CLASS` idiom (solid color for the
 * accent, `-soft` for fill) so the same status-color vocabulary reads
 * identically in both views.
 */
const STATUS_ACCENT_CLASS: Record<string, string> = {
  green: "border-l-status-green bg-status-green-soft",
  red: "border-l-status-red bg-status-red-soft",
  teal: "border-l-status-teal bg-status-teal-soft",
  amber: "border-l-status-amber bg-status-amber-soft",
  outline: "border-l-border bg-muted/40",
};

export interface QuestCardProps {
  task: NormalizedTask;
  availability: QuestAvailability;
  pinned: boolean;
  /** Count of other quests transitively gated behind this one (see `getTasksBehindCounts`) - shown as a small badge when > 0. */
  tasksBehindCount?: number;
  /**
   * Whether to show this row's own trader avatar + name. Defaults to
   * `true` (`QuestList`'s flat view, where each row is the only place a
   * task's trader is shown). `TraderTaskBoard` passes `false` since its
   * per-trader `CardHeader` already shows that trader's avatar/name/color -
   * repeating it on every row inside that section would be redundant
   * noise. The `Lv {level}` half of the sub-line is unaffected either way.
   */
  showTrader?: boolean;
  onStart: (taskId: string) => void;
  onDone: (taskId: string) => void;
  onFail: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  /** Opens `QuestDetailDialog` for this task - clicking the name/description area, matching `QuestRecommendations`'/`QuestTreeView`'s existing "click a quest to see its detail" convention. */
  onOpenDetail: (taskId: string) => void;
}

/**
 * One quest row: name, trader, level, Kappa flag, status badge, and the
 * status-appropriate action buttons wired to `useTaskActions()` (passed
 * down as callback props rather than each card calling the hook itself,
 * so the underlying `tasksById` map/query are only built once per list).
 * Clicking the name/description area opens the quest's detail dialog - a
 * real, single-click, focusable Pin toggle button sits alongside it
 * (matching `HideoutTracker`'s established Star-toggle convention: a filled
 * vs. outline icon signaling state via `aria-pressed`, not a hidden
 * gesture). An earlier version toggled pin via double-click on the name
 * button instead - removed in favor of the dedicated Pin button once it
 * existed, since combining that with a click-to-open-detail handler on the
 * SAME element would have meant every double-click also fired two `click`
 * events first (browsers dispatch `click`, `click`, then `dblclick`),
 * briefly toggling the dialog open on every pin toggle.
 *
 * The row's left border + background carry a status accent
 * (`STATUS_ACCENT_CLASS`, keyed off the same `variant` the status `Badge`
 * already renders) so a long list/trader-grouped scan reads status at a
 * glance without hunting for the badge text - the same solid-border/soft-
 * fill idiom `QuestTreeView`'s `STATUS_NODE_CLASS` already established.
 * `showTrader`'s avatar reuses that same view's trader-portrait recipe
 * (`getTraderOutlineColor` ring, `bg-muted` circle fallback), scaled down
 * from its `h-16 w-16` lane-header size to `h-9 w-9` for a row.
 */
export function QuestCard({
  task,
  availability,
  pinned,
  tasksBehindCount,
  showTrader = true,
  onStart,
  onDone,
  onFail,
  onUndo,
  onTogglePin,
  onOpenDetail,
}: QuestCardProps) {
  const badge = statusBadge(task, availability);
  const accentClass = STATUS_ACCENT_CLASS[badge.variant ?? ""] ?? "border-l-border bg-card";

  return (
    <li
      className={`border-border hover:bg-accent flex items-center justify-between gap-3 rounded-md border border-l-4 p-3 text-sm transition-colors ${accentClass}`}
    >
      <button
        type="button"
        onClick={() => {
          onOpenDetail(task.id);
        }}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        {showTrader &&
          (task.trader.imageLink ? (
            // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
            <img
              src={task.trader.imageLink}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover outline-2 outline-offset-1"
              style={{ outlineColor: getTraderOutlineColor(task.trader.name) }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-muted h-9 w-9 shrink-0 rounded-full outline-2 outline-offset-1"
              style={{ outlineColor: getTraderOutlineColor(task.trader.name) }}
            />
          ))}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">
              {pinned && <span aria-hidden="true">📌 </span>}
              {task.name}
            </span>
            {tasksBehindCount !== undefined && tasksBehindCount > 0 && (
              <Badge variant="outline">{tasksBehindCount} behind</Badge>
            )}
            {task.kappaRequired && <Badge variant="kappa">Kappa</Badge>}
            {task.lightkeeperRequired && <Badge variant="outline">Lightkeeper</Badge>}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {showTrader
              ? `${task.trader.name} · Lv ${String(task.minPlayerLevel)}`
              : `Lv ${String(task.minPlayerLevel)}`}
          </div>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${pinned ? "Unpin" : "Pin"} ${task.name}`}
        aria-pressed={pinned}
        onClick={() => {
          onTogglePin(task.id);
        }}
      >
        <Pin className="h-4 w-4" aria-hidden="true" fill={pinned ? "currentColor" : "none"} />
      </Button>

      <Badge variant={badge.variant}>{badge.label}</Badge>

      <div className="flex shrink-0 gap-1.5">
        {availability.status === "notstarted" && (
          <Button
            type="button"
            size="sm"
            disabled={!availability.isAvailable}
            onClick={() => {
              onStart(task.id);
            }}
          >
            Start
          </Button>
        )}
        {availability.status === "inprog" && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onDone(task.id);
              }}
            >
              Complete
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onFail(task.id);
              }}
            >
              Fail
            </Button>
          </>
        )}
        {(availability.status === "done" || availability.status === "failed") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onUndo(task.id);
            }}
          >
            Undo
          </Button>
        )}
      </div>
    </li>
  );
}
