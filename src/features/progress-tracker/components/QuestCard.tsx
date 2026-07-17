import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";

import { formatDelayedUnlockEta } from "../selectors/quest-availability";

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
      return availability.delayedUnlock
        ? {
            label: `Locked - unlocks in ${formatDelayedUnlockEta(availability.delayedUnlock)}`,
            variant: "outline",
          }
        : { label: "Locked", variant: "outline" };
  }
}

export interface QuestCardProps {
  task: NormalizedTask;
  availability: QuestAvailability;
  pinned: boolean;
  /** Count of other quests transitively gated behind this one (see `getTasksBehindCounts`) - shown as a small badge when > 0. */
  tasksBehindCount?: number;
  onStart: (taskId: string) => void;
  onDone: (taskId: string) => void;
  onFail: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
}

/**
 * One quest row: name, trader, level, Kappa flag, status badge, and the
 * status-appropriate action buttons wired to `useTaskActions()` (passed
 * down as callback props rather than each card calling the hook itself,
 * so the underlying `tasksById` map/query are only built once per list).
 */
export function QuestCard({
  task,
  availability,
  pinned,
  tasksBehindCount,
  onStart,
  onDone,
  onFail,
  onUndo,
  onTogglePin,
}: QuestCardProps) {
  const badge = statusBadge(task, availability);

  return (
    <li className="border-border bg-card flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <button
        type="button"
        onDoubleClick={() => {
          onTogglePin(task.id);
        }}
        className="min-w-0 flex-1 text-left"
        aria-pressed={pinned}
        title="Double-click to pin/unpin"
      >
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
          {task.trader.name} · Lv {task.minPlayerLevel}
        </div>
      </button>

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
