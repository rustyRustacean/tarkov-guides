import { sortTraderNames } from "../selectors/trader-grouping";

import type { QuestChain } from "./quest-chains";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface QuestTreeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuestTreeTaskNode extends QuestTreeBox {
  kind: "task";
  taskId: string;
  laneTrader: string;
  layer: number;
}

export interface QuestTreeChainPart extends QuestTreeBox {
  taskId: string;
  partNumber: number;
}

export interface QuestTreeChainNode extends QuestTreeBox {
  kind: "chain";
  chainId: string;
  baseName: string;
  taskIds: readonly string[];
  traderNames: readonly string[];
  crossesTraders: boolean;
  laneTrader: string;
  layer: number;
  expanded: boolean;
  /** Always computed regardless of `expanded` (cheap - a pure function of this node's own position), so expand/collapse is a pure render-time decision, not a relayout trigger. */
  parts: readonly QuestTreeChainPart[];
}

export type QuestTreeNode = QuestTreeTaskNode | QuestTreeChainNode;

export interface QuestTreeEdge {
  fromTaskId: string;
  toTaskId: string;
}

export interface QuestTreeLane {
  traderName: string;
  x: number;
  width: number;
  /**
   * The horizontal span of this lane's own top (lowest-layer) node(s) -
   * not necessarily the full lane `x`/`width`, since a *deeper* layer can be
   * wider (a lane is sized by its busiest layer, see this module's doc
   * comment) and would otherwise pull a header positioned at `x`/`width`
   * left of where this trader's chain visually starts. The component
   * positions each lane's header (name/image) here instead, so it sits
   * directly over the first node(s) a viewer actually sees.
   */
  headerX: number;
  headerWidth: number;
}

export interface QuestTreeLayout {
  nodes: readonly QuestTreeNode[];
  edges: readonly QuestTreeEdge[];
  lanes: readonly QuestTreeLane[];
  width: number;
  height: number;
}

export interface QuestTreeLayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  columnGap?: number;
  rowGap?: number;
  laneGap?: number;
  laneHeaderHeight?: number;
  miniPartHeight?: number;
  miniPartGap?: number;
}

export const DEFAULT_NODE_WIDTH = 220;
export const DEFAULT_NODE_HEIGHT = 88;
const DEFAULT_COLUMN_GAP = 32;
const DEFAULT_ROW_GAP = 96;
const DEFAULT_LANE_GAP = 48;
/** Tall enough for a large trader avatar image with its name below it, plus breathing room before the first row of task nodes. */
export const DEFAULT_LANE_HEADER_HEIGHT = 120;
const DEFAULT_MINI_PART_HEIGHT = 40;
const DEFAULT_MINI_PART_GAP = 6;
/** Header strip height inside an expanded chain node (base name + collapse button), above its stacked mini-part rows - a fixed layout constant (not a `QuestTreeLayoutOptions` field) shared verbatim by the component so its absolutely-positioned header button lines up with where this module placed it. */
export const CHAIN_HEADER_HEIGHT = 24;

/** Diagonal offset (px, per stacked layer) applied to a collapsed multi-part chain's "ghost" cards behind its real front card - see `computeChainStackOffsets`. */
export const CHAIN_STACK_OFFSET_X = 3;
export const CHAIN_STACK_OFFSET_Y = 9;
/** Real Tarkov chains rarely exceed ~4-5 parts; capping keeps the stack from spreading an unreasonable distance for a pathologically long chain - the front card's own "N parts" label still conveys the true count regardless of how many ghost layers actually render. */
export const CHAIN_STACK_MAX_GHOSTS = 3;

/**
 * Ghost-layer offsets for a collapsed chain's "stack of cards" cue, one
 * entry per ghost behind the real front card, returned FURTHEST-OFFSET-FIRST
 * so a caller can `.map()` them directly in back-to-front DOM/paint order,
 * finishing with the real button last (frontmost). Identical-size, uniformly
 * diagonally-offset boxes painted back-to-front self-clip correctly with no
 * `clip-path` needed: each nearer layer's opaque fill exactly covers the
 * farther layer's non-exposed top-left border, leaving only an L-shaped
 * bottom-right sliver of each ghost visible - the same mechanism the
 * original single-ghost implementation already relied on.
 */
export function computeChainStackOffsets(
  partCount: number,
  maxGhosts = CHAIN_STACK_MAX_GHOSTS,
): readonly { offsetX: number; offsetY: number }[] {
  const ghostCount = Math.max(0, Math.min(partCount - 1, maxGhosts));
  const offsets: { offsetX: number; offsetY: number }[] = [];
  for (let layer = ghostCount; layer >= 1; layer -= 1) {
    offsets.push({ offsetX: layer * CHAIN_STACK_OFFSET_X, offsetY: layer * CHAIN_STACK_OFFSET_Y });
  }
  return offsets;
}

/**
 * A real multi-parent-aware layered/topological layout, extended with two
 * structural features beyond plain prerequisite depth:
 *
 * 1. **Trader swim lanes** - trader becomes the primary horizontal axis
 *    (columns, ordered via the canonical roster `sortTraderNames`), with
 *    prerequisite layer as the vertical axis within/across lanes. A trader
 *    with no currently-visible tasks contributes no lane, so lane count/
 *    width tracks what's actually on screen.
 * 2. **Collapsible multi-part chains** (`chains`, from `detectQuestChains`) -
 *    a chain is always exactly one layout unit for lane/layer/position
 *    purposes, regardless of `expandedChainIds` - expanding a chain only
 *    grows that one node's rendered height (pushing later rows down), it
 *    never moves any node's lane or x-position. This is what makes "expands
 *    in place" concrete.
 *
 * Every task's layer is still `max(layer(prerequisite) for each in-scope
 * prerequisite) + 1` (`0` for a task/chain with none) - the fix for the
 * confirmed bug in `old/tarkov-tips/src/components/kappa/quests/QuestTreeView.tsx`'s
 * `calculateTreeLayout`, which assigned each node's level via a single BFS
 * `visited` Set - a task with 2+ prerequisites only ever got positioned
 * relative to whichever prerequisite's traversal reached it first. This is
 * now computed per "unit" (a chain's member tasks collapse to one unit) over
 * the union of every member's own external prerequisites, so a chain
 * respects a later part's independent gate even though the chain looks like
 * one node.
 *
 * A `taskRequirements` entry pointing at an id not present in `tasks` is
 * skipped - matches the fail-open behavior `quest-availability.ts`'s
 * `arePrerequisitesMet` already uses for the same case. Cycles are broken by
 * treating an ancestor already being resolved as having no further
 * unresolved prerequisites, rather than recursing forever.
 *
 * `chains`/`expandedChainIds` both default to empty, which makes every unit
 * its own standalone lane-less... no - every task still gets a lane (its own
 * `trader.name`), so with no chains this degenerates to the single-lane
 * layout whenever every task shares one trader (as every existing test
 * fixture does), reproducing the pre-lane output exactly.
 */
export function computeQuestTreeLayout(
  tasks: readonly NormalizedTask[],
  chains: readonly QuestChain[] = [],
  expandedChainIds: ReadonlySet<string> = new Set(),
  options: QuestTreeLayoutOptions = {},
): QuestTreeLayout {
  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const nodeHeight = options.nodeHeight ?? DEFAULT_NODE_HEIGHT;
  const columnGap = options.columnGap ?? DEFAULT_COLUMN_GAP;
  const rowGap = options.rowGap ?? DEFAULT_ROW_GAP;
  const laneGap = options.laneGap ?? DEFAULT_LANE_GAP;
  const laneHeaderHeight = options.laneHeaderHeight ?? DEFAULT_LANE_HEADER_HEIGHT;
  const miniPartHeight = options.miniPartHeight ?? DEFAULT_MINI_PART_HEIGHT;
  const miniPartGap = options.miniPartGap ?? DEFAULT_MINI_PART_GAP;

  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  const chainById = new Map(chains.map((chain) => [chain.chainId, chain]));
  const chainByTaskId = new Map<string, QuestChain>();
  for (const chain of chains) {
    for (const taskId of chain.taskIds) chainByTaskId.set(taskId, chain);
  }

  function resolveUnitId(taskId: string): string {
    return chainByTaskId.get(taskId)?.chainId ?? taskId;
  }

  // One entry per unique unit id, in first-appearance order across `tasks` -
  // matches the pre-lane layout's "insertion order = input array order"
  // convention (still no explicit intra-cell sort beyond that).
  const orderedUnitIds: string[] = [];
  const seenUnits = new Set<string>();
  const unitTask = new Map<string, NormalizedTask>();
  for (const task of tasks) {
    const unitId = resolveUnitId(task.id);
    if (!unitTask.has(unitId)) unitTask.set(unitId, task);
    if (!seenUnits.has(unitId)) {
      seenUnits.add(unitId);
      orderedUnitIds.push(unitId);
    }
  }

  const prereqUnitIdsByUnit = new Map<string, Set<string>>();
  for (const task of tasks) {
    const unitId = resolveUnitId(task.id);
    const set = prereqUnitIdsByUnit.get(unitId) ?? new Set<string>();
    prereqUnitIdsByUnit.set(unitId, set);
    for (const requirement of task.taskRequirements) {
      if (!tasksById.has(requirement.taskId)) continue;
      const prereqUnitId = resolveUnitId(requirement.taskId);
      if (prereqUnitId !== unitId) set.add(prereqUnitId);
    }
  }

  const layerByUnit = new Map<string, number>();
  const resolving = new Set<string>();

  function resolveLayer(unitId: string): number {
    const cached = layerByUnit.get(unitId);
    if (cached !== undefined) return cached;
    if (resolving.has(unitId)) return 0;
    resolving.add(unitId);

    let layer = 0;
    for (const prereqUnitId of prereqUnitIdsByUnit.get(unitId) ?? []) {
      layer = Math.max(layer, resolveLayer(prereqUnitId) + 1);
    }

    resolving.delete(unitId);
    layerByUnit.set(unitId, layer);
    return layer;
  }

  for (const unitId of orderedUnitIds) resolveLayer(unitId);

  function laneTraderOf(unitId: string): string {
    const chain = chainById.get(unitId);
    if (chain) return chain.traderNames[0] ?? "";
    return unitTask.get(unitId)?.trader.name ?? "";
  }

  const laneNames = sortTraderNames(
    Array.from(new Set(orderedUnitIds.map((unitId) => laneTraderOf(unitId)))),
  );
  const laneIndexByTrader = new Map(laneNames.map((name, index) => [name, index]));

  const maxLayer = orderedUnitIds.length === 0 ? -1 : Math.max(0, ...layerByUnit.values());

  // Bucket units by (lane, layer), preserving `orderedUnitIds` order within
  // each bucket - the per-cell column order, same convention as before.
  const unitsByLaneAndLayer = new Map<string, string[]>();
  for (const unitId of orderedUnitIds) {
    const laneIndex = laneIndexByTrader.get(laneTraderOf(unitId)) ?? 0;
    const layer = layerByUnit.get(unitId) ?? 0;
    const key = `${String(laneIndex)}:${String(layer)}`;
    const bucket = unitsByLaneAndLayer.get(key);
    if (bucket) bucket.push(unitId);
    else unitsByLaneAndLayer.set(key, [unitId]);
  }

  function chainRenderedHeight(chain: QuestChain): number {
    const partCount = chain.taskIds.length;
    return (
      CHAIN_HEADER_HEIGHT + partCount * miniPartHeight + Math.max(partCount - 1, 0) * miniPartGap
    );
  }

  function unitRenderedHeight(unitId: string): number {
    const chain = chainById.get(unitId);
    if (chain && expandedChainIds.has(unitId)) return chainRenderedHeight(chain);
    return nodeHeight;
  }

  // Lane content widths: each lane's width is driven by its own busiest
  // layer, not its total unit count.
  const laneContentWidths = laneNames.map((_, laneIndex) => {
    let maxCellWidth = 0;
    for (let layer = 0; layer <= maxLayer; layer += 1) {
      const bucket = unitsByLaneAndLayer.get(`${String(laneIndex)}:${String(layer)}`);
      if (!bucket) continue;
      const cellWidth = bucket.length * nodeWidth + Math.max(bucket.length - 1, 0) * columnGap;
      maxCellWidth = Math.max(maxCellWidth, cellWidth);
    }
    return maxCellWidth;
  });

  const laneX: number[] = [];
  let cursorX = 0;
  for (const [laneIndex, laneWidth] of laneContentWidths.entries()) {
    laneX.push(cursorX);
    cursorX += laneWidth + (laneIndex < laneContentWidths.length - 1 ? laneGap : 0);
  }
  const width =
    laneContentWidths.reduce((sum, w) => sum + w, 0) + Math.max(laneNames.length - 1, 0) * laneGap;

  // Global row heights - shared across every lane, so depth stays visually
  // comparable across lanes without needing curved cross-lane edges.
  const rowHeight: number[] = [];
  for (let layer = 0; layer <= maxLayer; layer += 1) {
    let tallest = nodeHeight;
    for (let laneIndex = 0; laneIndex < laneNames.length; laneIndex += 1) {
      const bucket = unitsByLaneAndLayer.get(`${String(laneIndex)}:${String(layer)}`);
      if (!bucket) continue;
      for (const unitId of bucket) tallest = Math.max(tallest, unitRenderedHeight(unitId));
    }
    rowHeight.push(tallest);
  }
  const rowY: number[] = [];
  let cursorY = laneHeaderHeight;
  for (const height of rowHeight) {
    rowY.push(cursorY);
    cursorY += height + rowGap;
  }

  const nodes: QuestTreeNode[] = [];
  for (let laneIndex = 0; laneIndex < laneNames.length; laneIndex += 1) {
    for (let layer = 0; layer <= maxLayer; layer += 1) {
      const bucket = unitsByLaneAndLayer.get(`${String(laneIndex)}:${String(layer)}`);
      if (!bucket) continue;
      const cellWidth = bucket.length * nodeWidth + Math.max(bucket.length - 1, 0) * columnGap;
      const laneWidth = laneContentWidths[laneIndex] ?? 0;
      const laneOffsetX = (laneX[laneIndex] ?? 0) + (laneWidth - cellWidth) / 2;
      const y = rowY[layer] ?? laneHeaderHeight;

      bucket.forEach((unitId, column) => {
        const x = laneOffsetX + column * (nodeWidth + columnGap);
        const laneTrader = laneNames[laneIndex] ?? "";
        const chain = chainById.get(unitId);

        if (chain) {
          const expanded = expandedChainIds.has(unitId);
          const parts: QuestTreeChainPart[] = chain.taskIds.map((taskId, partIndex) => ({
            taskId,
            partNumber: partIndex + 1,
            x,
            y: y + CHAIN_HEADER_HEIGHT + partIndex * (miniPartHeight + miniPartGap),
            width: nodeWidth,
            height: miniPartHeight,
          }));
          nodes.push({
            kind: "chain",
            chainId: unitId,
            baseName: chain.baseName,
            taskIds: chain.taskIds,
            traderNames: chain.traderNames,
            crossesTraders: chain.crossesTraders,
            laneTrader,
            layer,
            expanded,
            x,
            y,
            width: nodeWidth,
            height: expanded ? chainRenderedHeight(chain) : nodeHeight,
            parts,
          });
        } else {
          nodes.push({
            kind: "task",
            taskId: unitId,
            laneTrader,
            layer,
            x,
            y,
            width: nodeWidth,
            height: nodeHeight,
          });
        }
      });
    }
  }

  // Built from the now-final `nodes` (not the lane/layer buckets above) so
  // `headerX`/`headerWidth` can read each lane's real top-layer node
  // positions directly, rather than re-deriving the same centering math a
  // second time.
  const lanes: QuestTreeLane[] = laneNames.map((traderName, index) => {
    const laneOriginX = laneX[index] ?? 0;
    const laneWidth = laneContentWidths[index] ?? 0;
    const laneNodes = nodes.filter((node) => node.laneTrader === traderName);
    if (laneNodes.length === 0) {
      return {
        traderName,
        x: laneOriginX,
        width: laneWidth,
        headerX: laneOriginX,
        headerWidth: laneWidth,
      };
    }
    const topLayer = Math.min(...laneNodes.map((node) => node.layer));
    const topLayerNodes = laneNodes.filter((node) => node.layer === topLayer);
    const headerX = Math.min(...topLayerNodes.map((node) => node.x));
    const headerRight = Math.max(...topLayerNodes.map((node) => node.x + node.width));
    return {
      traderName,
      x: laneOriginX,
      width: laneWidth,
      headerX,
      headerWidth: headerRight - headerX,
    };
  });

  const edges: QuestTreeEdge[] = [];
  for (const task of tasks) {
    for (const requirement of task.taskRequirements) {
      if (!tasksById.has(requirement.taskId)) continue;
      if (resolveUnitId(requirement.taskId) === resolveUnitId(task.id)) continue; // internal chain link
      edges.push({ fromTaskId: requirement.taskId, toTaskId: task.id });
    }
  }

  const height =
    maxLayer < 0 ? 0 : (rowY[maxLayer] ?? laneHeaderHeight) + (rowHeight[maxLayer] ?? nodeHeight);

  return { nodes, edges, lanes, width, height };
}

/**
 * Builds a real-task-id -> rendered-box lookup for edge drawing.
 * `computeQuestTreeLayout`'s edge list always uses real task ids on both
 * ends (never remapped to a synthetic chain id), so this is what resolves
 * each endpoint to the correct visual target depending on that task's
 * chain's current expand state: a collapsed chain's member id resolves to
 * the chain's own outer box, an expanded chain's member id resolves to that
 * specific mini-part's sub-position, and a standalone task id resolves to
 * its own node - all from the one stable edge list.
 */
export function buildEdgeEndpointIndex(layout: QuestTreeLayout): ReadonlyMap<string, QuestTreeBox> {
  const index = new Map<string, QuestTreeBox>();
  for (const node of layout.nodes) {
    if (node.kind === "task") {
      index.set(node.taskId, node);
      continue;
    }
    if (node.expanded) {
      for (const part of node.parts) index.set(part.taskId, part);
    } else {
      for (const taskId of node.taskIds) index.set(taskId, node);
    }
  }
  return index;
}

/**
 * Real-task-id -> the trader lane its rendered node/chain currently belongs
 * to (`QuestTreeNode.laneTrader`). A chain member id resolves to the CHAIN's
 * own `laneTrader` (its first part's trader), not that member's own
 * `trader.name` - correct for a `crossesTraders` chain (e.g. "Colleagues"),
 * whose whole unit renders in one lane. Lets `QuestTreeView` decide whether
 * an edge's two real task-id endpoints share a rendered lane, for
 * same-trader "elbow" edge routing.
 */
export function buildLaneTraderIndex(layout: QuestTreeLayout): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const node of layout.nodes) {
    if (node.kind === "task") {
      index.set(node.taskId, node.laneTrader);
    } else {
      for (const taskId of node.taskIds) index.set(taskId, node.laneTrader);
    }
  }
  return index;
}
