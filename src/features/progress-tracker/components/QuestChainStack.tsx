"use client";

import { aggregateChainStatus } from "../lib/quest-chains";
import { STATUS_NODE_CLASS, STATUS_NODE_TINT } from "../lib/quest-status-style";
import {
  CHAIN_STACK_OFFSET_X,
  CHAIN_STACK_OFFSET_Y,
  computeChainStackOffsets,
} from "../lib/quest-tree-layout";
import { getTraderOutlineColor } from "../selectors/trader-grouping";

import { QuestTaskChip } from "./QuestTaskChip";

import type { QuestChain } from "../lib/quest-chains";
import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface QuestChainStackProps {
  chain: QuestChain;
  tasksById: ReadonlyMap<string, NormalizedTask>;
  availability: ReadonlyMap<string, QuestAvailability>;
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  /** Set briefly when a search-dropdown jump targets a part inside this chain (see `TaskFocusRequest`); passed through to that part's `QuestTaskChip` once expanded. */
  highlightedTaskId?: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
}

/**
 * Matrix-cell counterpart to `QuestTreeView`'s collapsed chain node: bundles
 * a detected multi-part chain (e.g. "Small Business - Part 1/2/3") landing
 * in the same cell into one stacked-card affordance instead of listing every
 * part as its own flat `QuestTaskChip`, so a dense cell doesn't read as N
 * unrelated tasks. Collapsed by default, mirroring Tree, and reuses Tree's
 * own `computeChainStackOffsets`/`CHAIN_STACK_OFFSET_X/Y` so both views agree
 * on how many "extra cards" a given part count implies and how far each one
 * peeks out. `expanded` is controlled by `QuestSwimlaneMatrix` (not local
 * state) so a search-dropdown jump targeting a part inside a still-collapsed
 * chain can force it open the same way `QuestTreeView.expandedChainIds`
 * does, without a second, disconnected notion of "expanded."
 *
 * Unlike Tree (an absolutely-positioned canvas where every node already has
 * known pixel coordinates), these ghost cards can't be given a fixed
 * width/height up front: the real front card's height is whatever its own
 * text wraps to. Solved with a CSS Grid trick instead of measuring anything:
 * the front button and every ghost `div` share the exact same grid cell
 * (`gridArea: "1 / 1"`), so each ghost stretches to match the front card's
 * real (auto) size for free, then `translate()` shifts it down-and-right by
 * that layer's offset - a paint-only shift, so it doesn't feed back into the
 * grid track's own size calculation the way changing `top`/`left` would.
 *
 * The real button needs its own `relative` class, not just later DOM order,
 * to actually paint on top of the ghosts: a `transform` promotes an element
 * into the same "positioned" paint layer as `position: relative`/`absolute`
 * (CSS Transforms spec), which paints *after* plain static-position boxes
 * regardless of DOM order. Without `relative` here, the (transformed)
 * ghosts silently painted over the (static) button's own text - the bug
 * that shipped in an earlier version of this file. Ghosts themselves render
 * in back-to-front order (`computeChainStackOffsets` returns
 * furthest-first), so among the now-shared positioned layer, later (nearer)
 * ghosts occlude all but each farther one's bottom-right sliver, and the
 * button - also in that layer, and last in DOM order - sits on top of all
 * of them. The wrapper's own
 * `paddingRight`/`paddingBottom` (the single farthest layer's offset) is
 * real reserved space, not just visual overflow, so the peeking corner never
 * gets clipped by the matrix cell's `overflow-y-auto` and never overlaps the
 * next card below in the same cell.
 */
export function QuestChainStack({
  chain,
  tasksById,
  availability,
  selectedTaskId,
  onSelect,
  highlightedTaskId = null,
  expanded,
  onToggleExpanded,
}: QuestChainStackProps) {
  const statusKey = aggregateChainStatus(chain, availability);
  const stackOffsets = computeChainStackOffsets(chain.taskIds.length);
  const ghostCount = stackOffsets.length;
  const traderName: string | undefined = chain.traderNames[0];
  const chainSelected = selectedTaskId !== null && chain.taskIds.includes(selectedTaskId);

  if (expanded) {
    return (
      <div className="border-border bg-muted/10 flex flex-col gap-1.5 rounded-md border-2 border-dashed p-1.5">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="text-foreground hover:bg-accent flex items-center justify-between rounded px-1 text-xs font-medium"
        >
          <span className="truncate">{chain.baseName}</span>
          <span aria-hidden="true" className="whitespace-nowrap">
            ▴ collapse
          </span>
        </button>
        {chain.taskIds.map((taskId) => {
          const task = tasksById.get(taskId);
          if (!task) return null;
          return (
            <QuestTaskChip
              key={taskId}
              task={task}
              availability={availability.get(taskId)}
              selected={selectedTaskId === taskId}
              onSelect={onSelect}
              highlighted={highlightedTaskId === taskId}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="grid"
      style={{
        paddingRight: ghostCount * CHAIN_STACK_OFFSET_X,
        paddingBottom: ghostCount * CHAIN_STACK_OFFSET_Y,
      }}
    >
      {stackOffsets.map((offset) => (
        <div
          key={`${String(offset.offsetX)}-${String(offset.offsetY)}`}
          aria-hidden="true"
          className="border-border bg-card rounded-md border-2 shadow-sm"
          style={{
            gridArea: "1 / 1",
            transform: `translate(${String(offset.offsetX)}px, ${String(offset.offsetY)}px)`,
          }}
        />
      ))}
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-label={`${chain.baseName}, collapsed chain of ${String(chain.taskIds.length)} parts`}
        title="Click to expand"
        className={`relative flex flex-col items-start rounded-md border-2 p-2 text-left text-xs shadow-sm outline-2 outline-offset-1 transition-transform hover:scale-[1.02] ${
          STATUS_NODE_CLASS[statusKey] ?? ""
        } ${chainSelected ? "ring-ring ring-2" : ""}`}
        style={{
          gridArea: "1 / 1",
          // Overrides the className's translucent `bg-status-*-soft`/`bg-muted/40`
          // with the same tint flattened onto an opaque `--color-card` backdrop,
          // so the ghost cards stacked directly behind this button in the same
          // grid cell don't show through it and muddy the front card's text.
          backgroundColor: "var(--color-card)",
          backgroundImage: `linear-gradient(${STATUS_NODE_TINT[statusKey] ?? "transparent"}, ${STATUS_NODE_TINT[statusKey] ?? "transparent"})`,
          outlineColor: traderName ? getTraderOutlineColor(traderName) : undefined,
        }}
      >
        <span className="max-w-full truncate font-medium">{chain.baseName}</span>
        <span className="text-muted-foreground max-w-full truncate">
          {chain.taskIds.length} parts
          {chain.crossesTraders ? ` · ${chain.traderNames.join(" → ")}` : ""}
        </span>
      </button>
    </div>
  );
}
