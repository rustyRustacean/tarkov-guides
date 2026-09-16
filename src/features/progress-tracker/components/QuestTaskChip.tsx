import { nodeStatusKey, STATUS_NODE_CLASS } from "../lib/quest-status-style";
import { getTraderOutlineColor } from "../selectors/trader-grouping";

import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface QuestTaskChipProps {
  task: NormalizedTask;
  availability: QuestAvailability | undefined;
  selected: boolean;
  onSelect: (taskId: string) => void;
  /** Set briefly by `QuestSwimlaneMatrix` after a search-dropdown jump lands on this exact chip (see `TaskFocusRequest`): rings and pulses it, same visual language as `QuestTreeView`'s own search highlight, distinct from `selected`'s steadier ring. */
  highlighted?: boolean;
}

/**
 * Compact clickable task card shared by `QuestSwimlaneMatrix` and
 * `QuestChainStack`, styled to match `QuestTreeView`'s node buttons exactly
 * (same `STATUS_NODE_CLASS` coloring, same trader outline, same kappa-key
 * badge) so the two board views read as one system. `QuestTreeView` keeps
 * its own node rendering (it needs absolute positioning from the layout
 * engine this chip doesn't participate in). Carries `data-task-id` so
 * `QuestSwimlaneMatrix` can find and scroll to a specific chip via
 * `querySelector` without threading a ref through every card.
 */
export function QuestTaskChip({
  task,
  availability,
  selected,
  onSelect,
  highlighted = false,
}: QuestTaskChipProps) {
  const statusKey = nodeStatusKey(availability);
  return (
    <button
      type="button"
      data-task-id={task.id}
      className={`relative flex w-full flex-col items-start rounded-md border-2 p-2 text-left text-xs shadow-sm outline-2 outline-offset-1 transition-transform hover:scale-[1.02] ${
        STATUS_NODE_CLASS[statusKey] ?? ""
      } ${highlighted ? "ring-primary animate-pulse ring-4" : selected ? "ring-ring ring-2" : ""}`}
      style={{ outlineColor: getTraderOutlineColor(task.trader.name) }}
      onClick={() => {
        onSelect(task.id);
      }}
    >
      <span className="max-w-full truncate font-medium">{task.name}</span>
      <span className="text-muted-foreground max-w-full truncate">Lv {task.minPlayerLevel}</span>
      {task.kappaRequired && (
        <span
          aria-hidden="true"
          title="Required for Kappa"
          className="bg-status-amber absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] leading-none shadow-sm"
        >
          🔑
        </span>
      )}
      {task.hasHiddenRequirement && (
        <span
          aria-hidden="true"
          title="Hidden unlock condition, not exposed by tarkov.dev"
          className="bg-status-violet absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] leading-none shadow-sm"
        >
          🔒
        </span>
      )}
    </button>
  );
}
