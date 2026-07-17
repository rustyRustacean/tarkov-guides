"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";

import { useActiveFaction } from "../hooks/use-active-faction";
import { aggregateChainStatus, detectQuestChains, getChainActiveTaskId } from "../lib/quest-chains";
import { buildEdgePath, computeEdgeLabelPositions } from "../lib/quest-tree-edges";
import {
  buildEdgeEndpointIndex,
  buildLaneTraderIndex,
  CHAIN_HEADER_HEIGHT,
  computeChainStackOffsets,
  computeQuestTreeLayout,
  DEFAULT_LANE_HEADER_HEIGHT,
} from "../lib/quest-tree-layout";
import { computeWheelZoom } from "../lib/quest-tree-zoom";
import { getQuestAvailability } from "../selectors/quest-availability";
import { getTraderOutlineColor, TRADER_OUTLINE_LEGEND } from "../selectors/trader-grouping";
import { useProgressTrackerStore } from "../store";

import { QuestDetailDialog } from "./QuestDetailDialog";

import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";
import type { MouseEvent as ReactMouseEvent, WheelEvent } from "react";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.2;
const EMPTY_AVAILABILITY: ReadonlyMap<string, QuestAvailability> = new Map();

const STATUS_NODE_CLASS: Record<string, string> = {
  done: "border-status-green bg-status-green-soft",
  failed: "border-status-red bg-status-red-soft",
  inprog: "border-status-teal bg-status-teal-soft",
  // Amber background only, neutral border - an amber outline read as too
  // close to a highlighted/selected state; the soft fill alone is enough
  // to distinguish "available" from "locked" at a glance.
  available: "border-border bg-status-amber-soft",
  locked: "border-border bg-muted/40",
};

const STATUS_LEGEND: readonly { label: string; swatchClass: string }[] = [
  { label: "Done", swatchClass: "border-status-green bg-status-green-soft" },
  { label: "In progress", swatchClass: "border-status-teal bg-status-teal-soft" },
  { label: "Available", swatchClass: "border-border bg-status-amber-soft" },
  { label: "Locked", swatchClass: "border-border bg-muted/40" },
  { label: "Failed", swatchClass: "border-status-red bg-status-red-soft" },
];

function nodeStatusKey(availability: QuestAvailability | undefined): string {
  if (!availability) return "locked";
  if (availability.status !== "notstarted") return availability.status;
  return availability.isAvailable ? "available" : "locked";
}

/**
 * Renders `computeQuestTreeLayout`'s trader-lane positions as an SVG-
 * connected node graph - the "Tree" view mode of `QuestBoard`. Unlike
 * `old/tarkov-tips/src/components/kappa/quests/QuestTreeView.tsx`, this
 * deliberately drops the force-directed/circular layout modes (visual
 * novelties with no bearing on quest dependencies) and keeps only the
 * layered layout, since that is the one this migration actually needed to
 * fix (see `lib/quest-tree-layout.ts`'s doc comment for the confirmed bug).
 *
 * Two structural features beyond the original layered layout (2026-07-16
 * redesign): trader becomes the primary horizontal axis
 * (swim lanes, one column per trader with a currently-visible task, ordered
 * via the canonical roster) and multi-part "- Part N" quest chains
 * (`detectQuestChains`) collapse into one stacked node by default, expanding
 * in place on click into their individual parts.
 *
 * Fully Google Maps-style viewport: `overflow-hidden` (no native
 * scrollbars), wheel/trackpad-pinch zoom anchored on the cursor
 * (`computeWheelZoom`, pulled out for unit-testability), and click-drag
 * panning (hand-rolled `mousedown`+window-level `mousemove`/`mouseup`, not
 * native scroll) - both drive one `pan`/`zoom` state pair applied as a
 * single `translate() scale()` transform, replacing an earlier version that
 * used real `scrollLeft`/`scrollTop` (which fought the browser's own wheel-
 * scroll handling instead of purely zooming, and couldn't support drag-pan
 * without conflicting with native scroll). +/-/Reset buttons remain as a
 * non-pointer-driven alternative. Locked (unmet-prerequisite) tasks are
 * shown by default (2026-07-16: flipped from hidden-by-default now that Tree
 * is the default view mode - a first-time visitor should see the whole
 * reachable-plus-upcoming picture, not an apparently-sparse graph) -
 * `showLocked` still hides them if toggled off. Each quest view (List/Tree/
 * Trader) keeps this as its own local toggle rather than a shared one,
 * matching how `kappaOnly` already worked here before it.
 *
 * A row of per-trader "jump" buttons (one per currently-visible lane, in
 * canonical roster order via `layout.lanes`) sits in the same toolbar row as
 * the checkboxes - clicking one pans so that lane's header lands at the
 * viewport's top-CENTER, i.e. "jump to the start of" that trader's chain,
 * without changing the current zoom level.
 *
 * Each lane header shows the trader's own large avatar image with their name
 * below it, positioned at `lane.headerX`/`headerWidth` (the top-layer node
 * span, not the lane's full `x`/`width` - see `QuestTreeLane`'s doc comment
 * in `lib/quest-tree-layout.ts`) so it sits directly over the first node(s)
 * rather than the lane's sometimes-wider bounding box.
 *
 * Prerequisite edges (`lib/quest-tree-edges.ts`) are always visible but
 * deliberately subdued at rest (`stroke-border`, thin) so the graph reads as
 * clean node clusters rather than a loud web of lines, and bold up
 * (`stroke-primary`, thicker) on hover to call out exactly what a node
 * connects to. A same-trader edge routes with a single right-angle "elbow"
 * jog (`buildEdgePath`'s `sameTrader` branch) instead of a diagonal, visually
 * distinguishing an in-lane dependency from a cross-trader one; a hovered
 * cross-trader edge additionally shows each endpoint task's name as a small
 * label near that end (`computeEdgeLabelPositions`) so a line that travels
 * far across the canvas is still traceable without hunting for its other
 * end - same-trader edges skip labeling since their short path is already
 * easy to read by eye.
 *
 * A collapsed multi-part chain node gets one static ghost card per extra
 * part drawn behind it (`computeChainStackOffsets`, capped at
 * `CHAIN_STACK_MAX_GHOSTS`), each offset a little further down-and-right, so
 * an N-part chain visibly reads as a stack of N cards - replacing the old
 * fixed single-ghost-regardless-of-count version and the small 3-layer icon
 * that originally carried this "this is actually several tasks" signal at
 * icon scale.
 *
 * Takes over the full page width and remaining viewport height while this
 * tab is active (`w-screen` breakout out of `ProgressTrackerPage`'s
 * `max-w-[1600px]` column). The height is measured, not guessed: a fixed
 * `calc(100vh-…)` Tailwind class can't account for this page's variable-
 * height chrome above (title/tabs/toolbar), so `wrapperRef`'s distance from
 * the viewport top is read on mount (Radix `Tabs` unmounts inactive content,
 * so this reruns fresh every time the Tree tab becomes active again) and on
 * `resize`, filling exactly to the bottom of the screen so nothing below the
 * map (footer included) is visible without scrolling past it - the
 * `h-[calc(100vh-22rem)]` class is only a pre-measurement/no-JS fallback.
 * The legend (status + per-trader outline key) is an overlay in the
 * top-right corner of the viewport itself rather than a separate row below
 * it, so none of that vertical space is spent on chrome.
 */
export function QuestTreeView() {
  const { data } = useTarkovGameData();
  const allTasks = data?.tasks;
  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();

  const [kappaOnly, setKappaOnly] = useState(false);
  const [showLocked, setShowLocked] = useState(true);
  const [expandedChainIds, setExpandedChainIds] = useState<ReadonlySet<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Measures real remaining space down to the bottom of the viewport
  // (see the doc comment above) instead of trusting a guessed `calc(100vh-…)`
  // offset - reruns on mount (fresh every time this tab becomes active again,
  // since Radix `Tabs` unmounts inactive content) and on `resize`.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function measure(): void {
      if (!wrapper) return;
      setWrapperHeight(Math.max(320, window.innerHeight - wrapper.getBoundingClientRect().top));
    }

    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  const tasks = useMemo((): readonly NormalizedTask[] => {
    const source = allTasks ?? [];
    return kappaOnly ? source.filter((task) => task.kappaRequired) : source;
  }, [allTasks, kappaOnly]);

  // Memoized (unlike a plain `const`) because `visibleTasks` below depends on
  // it - without a stable reference, that memo (and the `layout` it in turn
  // feeds) would recompute every render, including every wheel-zoom tick.
  const availability = useMemo(
    () =>
      progress && activeFaction !== undefined
        ? getQuestAvailability(tasks, progress, activeFaction)
        : undefined,
    [tasks, progress, activeFaction],
  );

  // Locked (unmet-prerequisite) tasks are shown by default - `showLocked`
  // hides them if toggled off, same per-view toggle pattern as `kappaOnly`
  // (each quest view - List, Tree, Trader - keeps its own independent filter
  // state rather than a shared one; see `TraderTaskBoard`'s doc comment).
  const visibleTasks = useMemo(
    () =>
      showLocked ? tasks : tasks.filter((task) => availability?.get(task.id)?.isLocked !== true),
    [tasks, showLocked, availability],
  );

  // Chain detection runs on the already-filtered `visibleTasks` (not
  // `allTasks`), so a partially-hidden chain just yields a shorter - or no -
  // detected chain for free, with zero special-casing needed here.
  const chains = useMemo(() => detectQuestChains(visibleTasks), [visibleTasks]);

  function toggleChainExpanded(chainId: string): void {
    setExpandedChainIds((current) => {
      const next = new Set(current);
      if (next.has(chainId)) next.delete(chainId);
      else next.add(chainId);
      return next;
    });
  }

  const chainIdByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const chain of chains) {
      for (const taskId of chain.taskIds) map.set(taskId, chain.chainId);
    }
    return map;
  }, [chains]);

  const layout = useMemo(
    () => computeQuestTreeLayout(visibleTasks, chains, expandedChainIds),
    [visibleTasks, chains, expandedChainIds],
  );

  const edgeEndpoints = useMemo(() => buildEdgeEndpointIndex(layout), [layout]);
  const laneTraderIndex = useMemo(() => buildLaneTraderIndex(layout), [layout]);

  // Each lane is only as wide as its own busiest layer (see
  // `computeQuestTreeLayout`'s doc comment), so a sparser lane/root layer can
  // sit far from the viewport's default (0,0) origin - without this, the
  // viewport renders blank until the user pans manually. Re-centers whenever
  // the rendered layout's overall width changes (not on every new `layout`
  // object - expanding/collapsing a chain produces a new `layout` but never
  // changes `width` by construction, and re-keying on the whole object would
  // otherwise snap the viewport back to the top on every expand/collapse
  // click, which is disorienting).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPan({ x: Math.max(0, (viewport.clientWidth - layout.width) / 2), y: 0 });
  }, [layout.width]);

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const result = computeWheelZoom({
      currentZoom: zoom,
      deltaY: event.deltaY,
      panX: pan.x,
      panY: pan.y,
      cursorX: event.clientX - rect.left,
      cursorY: event.clientY - rect.top,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    setZoom(result.zoom);
    setPan({ x: result.panX, y: result.panY });
  }

  // Hand-rolled drag-to-pan: window-level (not element-level) move/up
  // listeners so a fast drag that leaves the viewport's bounds mid-gesture
  // still tracks correctly and always ends on mouseup. Left-click only
  // (`button !== 0` bails) so this doesn't hijack right/middle-click.
  // `preventDefault` stops the browser's own drag-to-select-text behavior
  // over the node buttons' text - doesn't block their `onClick`, which
  // fires from mouseup independently of this.
  function handlePointerDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startMouseX = event.clientX;
    const startMouseY = event.clientY;
    const startPan = pan;
    setIsPanning(true);

    function handleMove(moveEvent: globalThis.MouseEvent): void {
      setPan({
        x: startPan.x + (moveEvent.clientX - startMouseX),
        y: startPan.y + (moveEvent.clientY - startMouseY),
      });
    }
    function handleUp(): void {
      setIsPanning(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  // Pans so `traderName`'s lane header lands at the viewport's top-CENTER
  // ("jump to the start of" that trader's chain) at the current zoom level -
  // `viewportPoint = contentPoint * zoom + pan` (same relation
  // `computeWheelZoom`'s doc comment derives), solved for `pan` with the
  // viewport-side x pinned to the viewport's horizontal midpoint (not its
  // left edge) so the lane centers instead of hugging the left side, and y
  // pinned to a small fixed inset so the header isn't flush against the
  // viewport's top border. Uses `headerX`/`headerWidth` (the top-layer
  // node span's own midpoint), not the lane's raw `x`, so this actually
  // centers the first visible node rather than the lane's wider bounding box.
  function jumpToTrader(traderName: string): void {
    const lane = layout.lanes.find((entry) => entry.traderName === traderName);
    const viewport = viewportRef.current;
    if (!lane || !viewport) return;
    const topInset = 24;
    const laneHeaderCenterX = lane.headerX + lane.headerWidth / 2;
    setPan({ x: viewport.clientWidth / 2 - laneHeaderCenterX * zoom, y: topInset });
  }

  const taskById = useMemo(
    () => new Map(visibleTasks.map((task) => [task.id, task])),
    [visibleTasks],
  );

  // First visible task per trader is enough - every task for a given trader
  // shares the same `trader.imageLink`, so there's no need to scan further.
  const traderImageByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const task of visibleTasks) {
      if (!map.has(task.trader.name)) map.set(task.trader.name, task.trader.imageLink);
    }
    return map;
  }, [visibleTasks]);

  if (!progress || activeFaction === undefined) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to view the quest tree.
      </p>
    );
  }

  const resolvedAvailability = availability ?? EMPTY_AVAILABILITY;

  function isHoveredEdge(edgeTaskId: string): boolean {
    if (hoveredId === null) return false;
    return edgeTaskId === hoveredId || chainIdByTaskId.get(edgeTaskId) === hoveredId;
  }

  return (
    <div
      ref={wrapperRef}
      className="relative left-1/2 -ml-[50vw] flex h-[calc(100vh-22rem)] w-screen flex-col gap-3"
      style={wrapperHeight !== null ? { height: wrapperHeight } : undefined}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 text-sm">
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={kappaOnly}
            onChange={(event) => {
              setKappaOnly(event.target.checked);
            }}
          />
          Kappa only
        </label>

        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={showLocked}
            onChange={(event) => {
              setShowLocked(event.target.checked);
            }}
          />
          Show locked
        </label>

        {layout.lanes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Jump to:</span>
            {layout.lanes.map((lane) => (
              <button
                key={lane.traderName}
                type="button"
                className="hover:bg-accent rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                style={{ borderColor: getTraderOutlineColor(lane.traderName) }}
                onClick={() => {
                  jumpToTrader(lane.traderName);
                }}
              >
                {lane.traderName}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="border-border hover:bg-accent rounded-md border px-2 py-1 text-xs"
            onClick={() => {
              setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP));
            }}
          >
            Zoom out
          </button>
          <span className="text-muted-foreground w-12 text-center text-xs">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="border-border hover:bg-accent rounded-md border px-2 py-1 text-xs"
            onClick={() => {
              setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP));
            }}
          >
            Zoom in
          </button>
          <button
            type="button"
            className="border-border hover:bg-accent rounded-md border px-2 py-1 text-xs"
            onClick={() => {
              setZoom(1);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Mouse-only pan/zoom canvas (drag-to-pan, wheel-to-zoom) - the
          keyboard-accessible surface is each real `<button>` node inside it
          (tab-navigable, has its own onClick) plus the +/-/Reset buttons
          above for zoom; there's no meaningful keyboard equivalent for
          panning a 2D canvas, so this intentionally doesn't add one. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={viewportRef}
        className="border-border bg-muted/20 relative mx-4 min-h-0 flex-1 overflow-hidden rounded-lg border select-none"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
      >
        {visibleTasks.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">No quests to show.</p>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: layout.width,
              height: layout.height,
              transform: `translate(${String(pan.x)}px, ${String(pan.y)}px) scale(${String(zoom)})`,
              transformOrigin: "0 0",
            }}
          >
            <svg
              className="pointer-events-none absolute top-0 left-0"
              width={layout.width}
              height={layout.height}
            >
              {layout.edges.map((edge) => {
                const from = edgeEndpoints.get(edge.fromTaskId);
                const to = edgeEndpoints.get(edge.toTaskId);
                if (!from || !to) return null;
                const isHovered = isHoveredEdge(edge.fromTaskId) || isHoveredEdge(edge.toTaskId);
                const sameTrader =
                  laneTraderIndex.get(edge.fromTaskId) === laneTraderIndex.get(edge.toTaskId);
                const x1 = from.x + from.width / 2;
                const y1 = from.y + from.height;
                const x2 = to.x + to.width / 2;
                const y2 = to.y;
                return (
                  <path
                    key={`${edge.fromTaskId}->${edge.toTaskId}`}
                    d={buildEdgePath(x1, y1, x2, y2, sameTrader)}
                    strokeWidth={isHovered ? 3 : 1.25}
                    className={`fill-none transition-colors ${isHovered ? "stroke-primary" : "stroke-border"}`}
                  />
                );
              })}
            </svg>

            {layout.lanes.map((lane) => {
              const traderImage = traderImageByName.get(lane.traderName);
              return (
                <div
                  key={lane.traderName}
                  className="text-muted-foreground absolute flex flex-col items-center justify-start gap-2"
                  style={{
                    left: lane.headerX,
                    top: 0,
                    width: lane.headerWidth,
                    height: DEFAULT_LANE_HEADER_HEIGHT,
                  }}
                >
                  {traderImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                    <img
                      src={traderImage}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-full object-cover outline-2 outline-offset-1"
                      style={{ outlineColor: getTraderOutlineColor(lane.traderName) }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bg-muted h-16 w-16 shrink-0 rounded-full outline-2 outline-offset-1"
                      style={{ outlineColor: getTraderOutlineColor(lane.traderName) }}
                    />
                  )}
                  <span className="max-w-full truncate text-xs font-semibold">
                    {lane.traderName}
                  </span>
                </div>
              );
            })}

            {layout.nodes.map((node) => {
              if (node.kind === "task") {
                const task = taskById.get(node.taskId);
                if (!task) return null;
                const statusKey = nodeStatusKey(resolvedAvailability.get(node.taskId));
                return (
                  <button
                    key={node.taskId}
                    type="button"
                    className={`absolute flex cursor-pointer flex-col items-center justify-center rounded-md border-2 p-2 text-center text-xs shadow-sm outline-2 outline-offset-1 transition-transform hover:scale-[1.03] ${STATUS_NODE_CLASS[statusKey] ?? ""} ${
                      selectedTaskId === node.taskId ? "ring-ring ring-2" : ""
                    }`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      outlineColor: getTraderOutlineColor(task.trader.name),
                    }}
                    onClick={() => {
                      setSelectedTaskId(node.taskId);
                    }}
                    onMouseEnter={() => {
                      setHoveredId(node.taskId);
                    }}
                    onMouseLeave={() => {
                      setHoveredId(null);
                    }}
                  >
                    <span className="truncate font-medium">{task.name}</span>
                    <span className="text-muted-foreground mt-1 truncate">
                      {task.trader.name} · Lv {task.minPlayerLevel}
                    </span>
                    {task.kappaRequired && (
                      <span
                        aria-hidden="true"
                        className="bg-status-amber absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] leading-none shadow-sm"
                      >
                        🔑
                      </span>
                    )}
                  </button>
                );
              }

              const statusKey = aggregateChainStatus(node, resolvedAvailability);

              if (!node.expanded) {
                // A collapsed chain bundles 2+ real tasks into one node (see
                // `detectQuestChains`) - one `aria-hidden` ghost card per
                // extra part (via `computeChainStackOffsets`, furthest-first)
                // renders behind the real button, each offset a few px
                // further down-and-right, so an N-part chain shows N total
                // cards - the same "this is actually a stack" cue the old
                // small 3-layer icon carried alone, now at full card scale.
                // Identical size + increasing offset + back-to-front paint
                // order means each nearer layer's opaque `bg-card` fill
                // naturally covers the farther layer's non-visible top-left
                // border, so only each ghost's true bottom-right sliver ever
                // shows - no `clip-path` needed.
                return (
                  <Fragment key={node.chainId}>
                    {computeChainStackOffsets(node.taskIds.length).map((offset) => (
                      <div
                        key={`${node.chainId}-ghost-${String(offset.offsetX)}-${String(offset.offsetY)}`}
                        aria-hidden="true"
                        className="border-border bg-card absolute rounded-md border-2 shadow-sm"
                        style={{
                          left: node.x + offset.offsetX,
                          top: node.y + offset.offsetY,
                          width: node.width,
                          height: node.height,
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      aria-label={`${node.baseName}, collapsed chain of ${String(node.taskIds.length)} parts`}
                      title="Click to expand · double-click to open the current part"
                      className={`absolute flex cursor-pointer flex-col items-center justify-center rounded-md border-2 p-2 text-center text-xs shadow-sm outline-2 outline-offset-1 transition-transform hover:scale-[1.03] ${STATUS_NODE_CLASS[statusKey] ?? ""} ${
                        selectedTaskId !== null && node.taskIds.includes(selectedTaskId)
                          ? "ring-ring ring-2"
                          : ""
                      }`}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        height: node.height,
                        outlineColor: getTraderOutlineColor(node.laneTrader),
                      }}
                      onClick={() => {
                        toggleChainExpanded(node.chainId);
                      }}
                      onDoubleClick={() => {
                        setSelectedTaskId(getChainActiveTaskId(node, resolvedAvailability));
                      }}
                      onMouseEnter={() => {
                        setHoveredId(node.chainId);
                      }}
                      onMouseLeave={() => {
                        setHoveredId(null);
                      }}
                    >
                      <span className="truncate font-medium">{node.baseName}</span>
                      <span className="text-muted-foreground mt-1 truncate">
                        {node.taskIds.length} parts
                        {node.crossesTraders ? ` · ${node.traderNames.join(" → ")}` : ""}
                      </span>
                    </button>
                  </Fragment>
                );
              }

              return (
                <Fragment key={node.chainId}>
                  <div
                    aria-hidden="true"
                    className="border-border bg-muted/10 absolute rounded-md border-2 border-dashed"
                    style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                  />
                  <button
                    type="button"
                    aria-label={`Collapse ${node.baseName}`}
                    className="text-foreground hover:bg-accent absolute flex items-center justify-between rounded-t-md px-2 text-xs font-medium"
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: CHAIN_HEADER_HEIGHT,
                    }}
                    onClick={() => {
                      toggleChainExpanded(node.chainId);
                    }}
                  >
                    <span className="truncate" aria-hidden="true">
                      {node.baseName}
                    </span>
                    <span aria-hidden="true">▴ collapse</span>
                  </button>
                  {node.parts.map((part) => {
                    const partTask = taskById.get(part.taskId);
                    if (!partTask) return null;
                    const partStatusKey = nodeStatusKey(resolvedAvailability.get(part.taskId));
                    return (
                      <button
                        key={part.taskId}
                        type="button"
                        className={`absolute flex cursor-pointer items-center justify-center gap-2 truncate rounded-md border-2 px-2 text-center text-xs outline-2 outline-offset-1 ${STATUS_NODE_CLASS[partStatusKey] ?? ""} ${
                          selectedTaskId === part.taskId ? "ring-ring ring-2" : ""
                        }`}
                        style={{
                          left: part.x,
                          top: part.y,
                          width: part.width,
                          height: part.height,
                          outlineColor: getTraderOutlineColor(partTask.trader.name),
                        }}
                        onClick={() => {
                          setSelectedTaskId(part.taskId);
                        }}
                        onMouseEnter={() => {
                          setHoveredId(part.taskId);
                        }}
                        onMouseLeave={() => {
                          setHoveredId(null);
                        }}
                      >
                        <span className="text-muted-foreground shrink-0">
                          Part {part.partNumber}
                        </span>
                        <span className="truncate">{partTask.name}</span>
                      </button>
                    );
                  })}
                </Fragment>
              );
            })}

            {/* Hover-only cross-trader edge labels - painted after every
                node above (position:absolute siblings paint in DOM order,
                no z-index needed) so they sit on top. Same-trader "elbow"
                edges skip labeling entirely (their short, adjacent-lane
                path is already easy to trace by eye). */}
            {layout.edges.map((edge) => {
              const isHovered = isHoveredEdge(edge.fromTaskId) || isHoveredEdge(edge.toTaskId);
              if (!isHovered) return null;
              if (laneTraderIndex.get(edge.fromTaskId) === laneTraderIndex.get(edge.toTaskId)) {
                return null;
              }
              const from = edgeEndpoints.get(edge.fromTaskId);
              const to = edgeEndpoints.get(edge.toTaskId);
              const fromTask = taskById.get(edge.fromTaskId);
              const toTask = taskById.get(edge.toTaskId);
              if (!from || !to || !fromTask || !toTask) return null;
              const { from: fromPos, to: toPos } = computeEdgeLabelPositions(
                from.x + from.width / 2,
                from.y + from.height,
                to.x + to.width / 2,
                to.y,
              );
              const labelClass =
                "bg-card/95 border-border pointer-events-none absolute rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap shadow-sm backdrop-blur-sm";
              return (
                <Fragment key={`label-${edge.fromTaskId}->${edge.toTaskId}`}>
                  <span
                    className={labelClass}
                    style={{ left: fromPos.x, top: fromPos.y, transform: "translate(-50%, 0)" }}
                  >
                    {fromTask.name}
                  </span>
                  <span
                    className={labelClass}
                    style={{ left: toPos.x, top: toPos.y, transform: "translate(-50%, -100%)" }}
                  >
                    {toTask.name}
                  </span>
                </Fragment>
              );
            })}
          </div>
        )}

        <div className="border-border bg-card/95 pointer-events-none absolute top-3 right-3 z-10 flex max-w-64 flex-col gap-2 rounded-lg border p-3 text-xs shadow-lg backdrop-blur-sm">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {STATUS_LEGEND.map(({ label, swatchClass }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 shrink-0 rounded border-2 ${swatchClass}`} />
                {label}
              </span>
            ))}
          </div>

          <div className="border-border border-t pt-1.5">
            <div className="text-muted-foreground mb-1 font-semibold">Trader</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {TRADER_OUTLINE_LEGEND.map(({ name, colorVar }) => (
                <span key={name} className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm outline-2 outline-offset-1"
                    style={{ outlineColor: colorVar }}
                  />
                  <span className="truncate">{name}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="text-muted-foreground border-border border-t pt-1.5">
            {visibleTasks.length} quests shown
          </div>
        </div>
      </div>

      <QuestDetailDialog
        taskId={selectedTaskId}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId(null);
        }}
        onSelectTask={setSelectedTaskId}
      />
    </div>
  );
}
