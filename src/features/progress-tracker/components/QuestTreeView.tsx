"use client";

import { ChevronDown, Eye, EyeOff, Info, Maximize2, Minimize2, Minus, Plus, X } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useFullscreen } from "@/shared/lib/use-fullscreen";
import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { useQuestAvailability } from "../hooks/use-quest-availability";
import { aggregateChainStatus, detectQuestChains, getChainActiveTaskId } from "../lib/quest-chains";
import { nodeStatusKey, STATUS_LEGEND, STATUS_NODE_CLASS } from "../lib/quest-status-style";
import { buildEdgePath, computeEdgeLabelPositions } from "../lib/quest-tree-edges";
import {
  buildEdgeEndpointIndex,
  buildLaneTraderIndex,
  CHAIN_HEADER_HEIGHT,
  computeChainStackOffsets,
  computeQuestTreeLayout,
  DEFAULT_LANE_HEADER_HEIGHT,
} from "../lib/quest-tree-layout";
import {
  computeTaskFocusPan,
  computeTraderJumpPan,
  computeWheelZoom,
  TASK_SEARCH_FOCUS_ZOOM,
} from "../lib/quest-tree-zoom";
import { TASK_FOCUS_HIGHLIGHT_MS } from "../lib/task-focus-request";
import {
  loyaltyBucketLabel,
  loyaltyBucketLayer,
  LOYALTY_BUCKET_ORDER,
  resolveLoyaltyBoardEntry,
} from "../selectors/loyalty-board";
import { getTraderOutlineColor, TRADER_OUTLINE_LEGEND } from "../selectors/trader-grouping";

import { NoActiveProfileNotice } from "./NoActiveProfileNotice";
import { QuestDetailDialog } from "./QuestDetailDialog";

import type { QuestTreeEdge, QuestTreeLane } from "../lib/quest-tree-layout";
import type { TaskFocusRequest } from "../lib/task-focus-request";
import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";
import type { MouseEvent as ReactMouseEvent, WheelEvent } from "react";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.2;
/** Below this canvas zoom level, lane-header trader avatars stop shrinking
 * further (counter-scaled back up to how big they'd be at this zoom) so
 * they stay legible when zoomed out, like a map pin that doesn't shrink to
 * a dot. Capped by `MIN_ZOOM` itself (the counter-scale factor tops out at
 * `LANE_ICON_FREEZE_ZOOM / MIN_ZOOM`), so it can never balloon large enough
 * to overlap neighboring lanes. */
const LANE_ICON_FREEZE_ZOOM = 0.5;
/** Duration of the CSS transition applied to the pan/zoom layer while a "Jump to" trader button's pan is in flight. See `jumpToTrader`. */
const JUMP_ANIMATION_MS = 450;
/** Reserved header strip at the top of every loyalty-tier row band (passed as `computeQuestTreeLayout`'s `rowHeaderHeight`), so the band's label/count badge has real space of its own instead of floating over the first node. */
const ROW_HEADER_HEIGHT = 36;
/**
 * Real tarkov.dev task name of the Kappa "Collector" quest (Fence). It has
 * so many prerequisite/dependent edges that they clutter the view by
 * default, so they're hidden behind a per-node eye-icon toggle
 * (`showCollectorLines`) instead. Hardcoded by name since this is a
 * one-off exception, not a general rule.
 */
const COLLECTOR_TASK_NAME = "Collector";
const EMPTY_AVAILABILITY: ReadonlyMap<string, QuestAvailability> = new Map();

/** Trader whose lane the viewport auto-jumps to on this component's first-ever mount in a page session (no `initialViewport` yet), rather than the generic "center the whole row" default. See `QuestBoard`'s doc comment for why the viewport is otherwise remembered/restored across tab switches instead of re-jumping here every time. */
const AUTO_JUMP_TRADER_NAME = "Mechanic";

/** `pan`/`zoom` snapshot handed to `onViewportChange` (see `QuestTreeViewProps`) so `QuestBoard` can restore it the next time this component mounts within the same page load. */
export interface QuestTreeViewport {
  pan: { x: number; y: number };
  zoom: number;
}

export interface QuestTreeViewProps {
  /** Set by `QuestBoard` when the user clicks a result in its search dropdown, only while Tree is the active tab. See `TaskFocusRequest`'s own doc comment and this component's doc comment for how Tree reacts to it. */
  focusRequest?: TaskFocusRequest | null;
  /**
   * Viewport this component last reported via `onViewportChange` before it
   * was previously unmounted (Radix `Tabs.Content` unmounts an inactive
   * tab's panel by default, so switching to Matrix and back to Tree
   * remounts this component from scratch). `null` means "never mounted
   * before in this page load", the only case that triggers the
   * `AUTO_JUMP_TRADER_NAME` auto-jump; `QuestBoard` holds this in plain
   * `useState` (not any persisted storage), so a real page refresh resets
   * it to `null` again, same as a first-ever visit.
   */
  initialViewport?: QuestTreeViewport | null;
  /** Called with the latest `{ pan, zoom }` on every change, so `QuestBoard` can hand it back as `initialViewport` if this component remounts later. See `initialViewport`'s doc comment. */
  onViewportChange?: (viewport: QuestTreeViewport) => void;
}

interface JumpToTraderMenuProps {
  lanes: readonly QuestTreeLane[];
  traderImageByName: ReadonlyMap<string, string | null>;
  onJump: (traderName: string) => void;
}

/**
 * Collapsed stand-in for the full per-trader avatar+name chip row (see
 * `renderTraderChip`/`jumpToChipsOverflow` in `QuestTreeView`) for whenever
 * there isn't enough toolbar width to show every chip without wrapping onto
 * a second line. A single "Jump to" button opens a hover card below it
 * listing the same trader chips (still with their avatars, so this mode
 * doesn't lose the at-a-glance icon recognition the full row has) - opens
 * on hover OR focus and closes on mouse-leave/blur/click-outside/Escape, so
 * it works for mouse, keyboard, and touch alike, not just hover. Hand-rolled
 * rather than pulling in `@radix-ui/react-popover` (not a dependency of
 * this project - `ContactLink` in the footer uses the same pattern for the
 * same reason).
 */
function JumpToTraderMenu({ lanes, traderImageByName, onJump }: JumpToTraderMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      <button
        type="button"
        className="hover:bg-accent flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
        onClick={() => {
          setOpen((current) => !current);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Jump to
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-card text-card-foreground absolute top-full left-0 z-20 mt-1 max-h-72 w-48 overflow-y-auto rounded-md border p-1 shadow-lg"
        >
          {lanes.map((lane) => {
            const traderImage = traderImageByName.get(lane.traderName);
            return (
              <button
                key={lane.traderName}
                type="button"
                role="menuitem"
                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium transition-colors"
                onClick={() => {
                  onJump(lane.traderName);
                  setOpen(false);
                }}
              >
                {traderImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                  <img
                    src={traderImage}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="bg-muted h-5 w-5 shrink-0 rounded-full" />
                )}
                {lane.traderName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Renders `computeQuestTreeLayout`'s trader-lane positions as an SVG node
 * graph. The "Tree" view mode of `QuestBoard`. Only the layered layout mode
 * is implemented; force-directed/circular modes from an earlier version
 * were dropped as visual novelties with no bearing on quest dependencies
 * (see `lib/quest-tree-layout.ts`'s doc comment for the layout bug this
 * migration fixed).
 *
 * Trader is the primary horizontal axis: one swim lane per trader with a
 * currently-visible task, ordered via the canonical roster. Multi-part
 * "Part N" quest chains (`detectQuestChains`) collapse into one stacked
 * node by default, expanding in place on click.
 *
 * The vertical axis is loyalty tier, not prerequisite depth (BSG's own
 * seasonal reorganization made prerequisite chains a poor primary
 * organizing principle: roughly a third of live tasks unlock via an opaque
 * internal condition with no derivable chain at all). Each task's row comes
 * from `resolveLoyaltyBoardEntry`/`loyaltyBucketLayer`, the same resolver
 * `QuestSwimlaneMatrix` uses, so the two board views agree on where a task
 * sits, fed into `computeQuestTreeLayout` via
 * its `layerByTaskId` option. A translucent labeled band per row
 * (`layout.rows`) makes each tier's boundary visible. Edges are still drawn
 * only for tasks with a real surviving `taskRequirements` link (mostly
 * same-story "Part N" sequences now), never fabricated for a loyalty-tier
 * gate, so expect them to be visually sparser than before this change,
 * including around Collector: tasks gated by an opaque internal condition
 * instead get a 🔒 badge (`task.hasHiddenRequirement`) rather than a
 * fictitious line.
 *
 * Google Maps-style viewport: `overflow-hidden` (no native scrollbars),
 * wheel/pinch zoom anchored on the cursor (`computeWheelZoom`, pulled out
 * for unit-testability), and click-drag panning (hand-rolled
 * `mousedown`+window-level `mousemove`/`mouseup`, not native scroll). Both
 * drive one `pan`/`zoom` state pair applied as a single
 * `translate() scale()` transform, replacing an earlier version built on
 * real `scrollLeft`/`scrollTop` that fought the browser's own wheel-scroll
 * handling and couldn't support drag-pan. +/-/Reset buttons remain as a
 * non-pointer-driven alternative.
 *
 * Locked (unmet-prerequisite) tasks are shown by default, same as every
 * other quest view: a first-time visitor should see the whole
 * reachable-plus-upcoming picture rather than an apparently-sparse graph.
 * `showLocked` still hides them if toggled off. Each quest view (Tree/
 * Matrix/Command Deck) keeps this as its own local toggle rather than a
 * shared one. Tree is no longer `QuestBoard`'s default tab (Matrix is,
 * since a dependency graph is a worse first impression now that so many
 * tasks have no derivable dependency at all), but a search-dropdown jump
 * still autozooms/pans here specifically when Tree is the active tab
 * (`focusOnTask`, below); Matrix and Command Deck each implement their own
 * equivalent "bring this task into view" reaction instead of sharing this
 * one, since a scroll-and-ring and a pan/zoom animation aren't the same
 * mechanism.
 *
 * A row of per-trader "jump" buttons (one per currently-visible lane, in
 * canonical roster order) pans so that lane's header lands at the
 * viewport's top center, at the current zoom level, animating the
 * transition (`isJumpAnimating`, see `jumpToTrader`) rather than cutting
 * instantly. On first load there's no single "right" trader to jump to (a
 * fresh profile can have quests available from several at once), so the
 * initial position is left to the generic recenter effect below, which
 * centers the whole trader row rather than favoring any one lane.
 *
 * Gunsmith's real in-game unlock structure for its first 3 parts doesn't
 * fit the generic per-part-prerequisite rule `detectQuestChains` otherwise
 * validates a chain against, so it's hardcoded into one stacked node
 * (`HARDCODED_CHAIN_BASE_NAMES` in `lib/quest-chains.ts`), the same narrow
 * exception mechanism as Collector (see `COLLECTOR_TASK_NAME` above).
 *
 * Each lane header shows the trader's avatar and name, positioned at
 * `lane.headerX`/`headerWidth` (the top-layer node span, not the lane's
 * full `x`/`width`; see `QuestTreeLane`'s doc comment in
 * `lib/quest-tree-layout.ts`) so it sits directly over the first node(s)
 * rather than the lane's sometimes-wider bounding box.
 *
 * Prerequisite edges (`lib/quest-tree-edges.ts`) are subdued at rest
 * (`stroke-border`, thin) so the graph reads as clean node clusters rather
 * than a web of lines, and bold on hover (`stroke-primary`, thicker) to
 * call out what a node connects to. A same-trader edge routes with a
 * single right-angle "elbow" jog instead of a diagonal, visually
 * distinguishing an in-lane dependency from a cross-trader one; a hovered
 * cross-trader edge also shows each endpoint task's name near that end so
 * a line crossing the canvas stays traceable without hunting for its other
 * end.
 *
 * Edges never visually cut through a node they merely pass behind: every
 * node's background is translucent, so an unmasked line drawn behind it
 * would bleed through. The at-rest edges layer is drawn through an SVG
 * `<mask>` (`nodeMaskId`) that punches an opaque hole for every node's box,
 * fully removing any segment underneath. A second, unmasked `<svg>` is
 * painted after every node button (so it's on top) and draws only the
 * currently-hovered edge(s) at full bold styling, letting a hovered task's
 * connections stay traceable through nodes they cross behind while every
 * other edge stays clipped underneath. Both layers share
 * `computeEdgeGeometry` so the hidden and hover-revealed renders of the
 * same edge never drift apart.
 *
 * A collapsed multi-part chain node gets one static ghost card per extra
 * part drawn behind it (`computeChainStackOffsets`, capped at
 * `CHAIN_STACK_MAX_GHOSTS`), each offset further down-and-right, so an
 * N-part chain visibly reads as a stack of N cards.
 *
 * Takes over the full page width and remaining viewport height while this
 * tab is active (`w-screen` breaks out of `ProgressTrackerPage`'s
 * `max-w-[1600px]` column; `-mb-4` breaks out of that page's trailing
 * `py-4` bottom padding; see the wrapper `className`'s own comment for why
 * the latter is needed). The height is measured, not guessed: a fixed
 * `calc(100vh-…)` Tailwind class can't account for this page's
 * variable-height chrome above (title/tabs/toolbar), so `wrapperRef`'s
 * distance from the viewport top is read on mount and on `resize`. It also
 * re-measures on `hasProfile` flipping true, not just on mount: before a
 * profile resolves, the component returns the early "no active profile"
 * `<p>` instead of the real wrapper, so `wrapperRef` never attaches on that
 * first mount, and a mount-only effect would silently measure nothing and
 * leave the rough CSS fallback in place forever.
 *
 * The legend (status + per-trader outline key) is an overlay in the
 * top-right corner of the viewport rather than a separate row below it, so
 * no vertical space is spent on chrome; it's collapsible independent of
 * fullscreen. The Fullscreen API target (`useFullscreen`, shared with the
 * Maps feature) is this same outer wrapper, so every control stays
 * reachable while fullscreen; the toolbar row gets extra top padding while
 * fullscreen since there's no page chrome above it once the wrapper fills
 * the screen.
 *
 * `QuestBoard`'s toolbar search box never filters this graph directly
 * (that would also delete the prerequisite/dependent edges that make Tree
 * worth using). Instead it shows its own results dropdown, and clicking a
 * result hands this component a `focusRequest` prop (`{ taskId, nonce }`,
 * see `TaskFocusRequest`) whenever Tree happens to be the active tab at
 * click time (`QuestBoard` no longer force-switches tabs on a search click;
 * each view focuses the task in place instead). `focusOnTask` "autozooms" to
 * that task: an animated jump that both pans
 * and sets zoom to a fixed comfortable level (`TASK_SEARCH_FOCUS_ZOOM`,
 * unlike a trader jump, which only pans), plus a temporary ring+pulse
 * (`highlightedTaskId`, cleared after `TASK_FOCUS_HIGHLIGHT_MS`). A match
 * buried inside a still-collapsed chain is expanded first, and a match
 * that arrives before this component's own data/layout is ready is
 * retried too; both go through `pendingFocusTaskId`, which defers the jump
 * until the task's real position exists in `layout.nodes`.
 */
export function QuestTreeView({
  focusRequest = null,
  initialViewport = null,
  onViewportChange,
}: QuestTreeViewProps) {
  const { tasks: allTasks } = useActiveModeTasks();
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();
  const hasProfile = progress !== undefined && activeFaction !== undefined;

  const [kappaOnly, setKappaOnly] = useState(false);
  const [showLocked, setShowLocked] = useState(true);
  const [expandedChainIds, setExpandedChainIds] = useState<ReadonlySet<string>>(new Set());
  // Lazily seeded from `initialViewport` (a restored session) so a returning
  // mount paints at the right spot on its very first frame instead of
  // flashing the default and then jumping. See the initial-position effect
  // below for the fresh-session (no `initialViewport`) case.
  const [zoom, setZoom] = useState(() => initialViewport?.zoom ?? 1);
  const [pan, setPan] = useState(() => initialViewport?.pan ?? { x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [isJumpAnimating, setIsJumpAnimating] = useState(false);
  const [showCollectorLines, setShowCollectorLines] = useState(false);
  // Whether the "Jump to" trader chip row needs more width than the
  // toolbar currently has to give it. See the measurement effect below
  // (keyed off `jumpToContainerRef`/`jumpToMeasureRef`) for how this gets
  // set; drives the switch between the full chip row and `JumpToTraderMenu`
  // in the render below.
  const [jumpToChipsOverflow, setJumpToChipsOverflow] = useState(false);
  // The task a search match is currently zoomed to and ring-highlighting.
  // Cleared automatically after `TASK_FOCUS_HIGHLIGHT_MS` (see the highlight
  // timeout effect below).
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  // Set instead of jumping immediately when a search match lives inside a
  // still-collapsed chain: expanding the chain changes `layout` on the next
  // render, and only that layout has real per-part node positions to jump
  // to. See the retry effect below.
  const [pendingFocusTaskId, setPendingFocusTaskId] = useState<string | null>(null);
  // Unique per mounted instance so the SVG `mask="url(#...)"` reference below
  // can't collide with another `QuestTreeView` (e.g. in tests rendering more
  // than one at once).
  const nodeMaskId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // `jumpToContainerRef` is the "Jump to" toolbar slot's own flexed width
  // (how much room is actually available); `jumpToMeasureRef` is a hidden,
  // absolutely-positioned, nowrap clone of the chip row (how much width it
  // would need to show every trader without wrapping). See the measurement
  // effect below for how these two get compared into `jumpToChipsOverflow`.
  const jumpToContainerRef = useRef<HTMLDivElement>(null);
  const jumpToMeasureRef = useRef<HTMLDivElement>(null);
  const jumpAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last `focusRequest.nonce` this component has already acted on. Lets
  // the focus-request effect below tell "a genuinely new request came in"
  // apart from "this component re-rendered for an unrelated reason while
  // the same request prop is still sitting there" (`focusRequest` itself
  // isn't cleared by the parent after being handled).
  const handledFocusNonceRef = useRef<number | null>(null);
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  // `wrapperRef` (height measurement, below) and `fullscreenRef` (the
  // Fullscreen API target) both need to point at the exact same DOM node. A
  // plain callback ref that writes both is simplest for a one-off merge
  // like this rather than a general-purpose "merge refs" utility.
  const setWrapperNode = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      fullscreenRef.current = node;
    },
    [fullscreenRef],
  );

  // Measures real remaining space down to the bottom of the viewport (the
  // wrapper's own `-mb-4` cancels the page's trailing padding out of the
  // box-model accounting, so no further subtraction is needed here; see
  // the wrapper `className`'s comment below) instead of trusting a guessed
  // `calc(100vh-…)` offset. Depends on `hasProfile`, not just `[]`: see
  // the doc comment above for why a mount-only effect would silently never
  // re-measure once a profile actually resolves. Also reruns on `resize`
  // for the ordinary window-resize case.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function measure(): void {
      if (!wrapper) return;
      // No `PAGE_BOTTOM_PADDING_PX` subtraction here. The wrapper's own
      // `-mb-4` below already cancels that trailing padding out of the
      // page's box-model accounting, so filling all the way to the
      // viewport's bottom edge is exactly what's needed (see that class's
      // neighboring comment).
      setWrapperHeight(Math.max(320, window.innerHeight - wrapper.getBoundingClientRect().top));
    }

    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [hasProfile]);

  const tasks = useMemo((): readonly NormalizedTask[] => {
    const source = allTasks ?? [];
    return kappaOnly ? source.filter((task) => task.kappaRequired) : source;
  }, [allTasks, kappaOnly]);

  // Shared with every other quest view via `useQuestAvailability()` rather
  // than re-deriving its own copy. Gates the full task list (not just this
  // component's own `kappaOnly`-filtered `tasks`): a few harmless extra Map
  // entries in exchange for every quest view computing this identically,
  // rather than each one's `kappaOnly` filter subtly changing what "gated"
  // even means from view to view.
  const availability = useQuestAvailability();

  // Locked (unmet-prerequisite) tasks are shown by default. `showLocked`
  // hides them if toggled off, same per-view toggle pattern as `kappaOnly`
  // (each quest view keeps its own independent filter state rather than a
  // shared one; see this component's own doc comment above).
  const visibleTasks = useMemo(
    () =>
      showLocked ? tasks : tasks.filter((task) => availability?.get(task.id)?.isLocked !== true),
    [tasks, showLocked, availability],
  );

  // Chain detection runs on the already-filtered `visibleTasks` (not
  // `allTasks`), so a partially-hidden chain just yields a shorter (or
  // absent) detected chain for free, with zero special-casing needed here.
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

  // Loyalty tier (not prerequisite depth) is what a "layer" means now: see
  // `computeQuestTreeLayout`'s `layerByTaskId` option doc comment. Built off
  // the same `resolveLoyaltyBoardEntry` the Matrix/Accordion views use, so
  // all three boards agree on where a task sits.
  const layerByTaskId = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of visibleTasks) {
      map.set(task.id, loyaltyBucketLayer(resolveLoyaltyBoardEntry(task).bucket));
    }
    return map;
  }, [visibleTasks]);

  // Real task counts per row band (not layout "units": a collapsed chain
  // is one node but several tasks), shown in each band's header so a
  // viewer can tell a tall wrapped row apart from "nothing here."
  const rowTaskCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const layer of layerByTaskId.values()) counts.set(layer, (counts.get(layer) ?? 0) + 1);
    return counts;
  }, [layerByTaskId]);

  const layout = useMemo(
    () =>
      computeQuestTreeLayout(visibleTasks, chains, expandedChainIds, {
        layerByTaskId,
        rowHeaderHeight: ROW_HEADER_HEIGHT,
      }),
    [visibleTasks, chains, expandedChainIds, layerByTaskId],
  );

  const edgeEndpoints = useMemo(() => buildEdgeEndpointIndex(layout), [layout]);
  const laneTraderIndex = useMemo(() => buildLaneTraderIndex(layout), [layout]);

  // Shared by both edge SVG layers below (the masked at-rest layer and the
  // unmasked hover-reveal layer) so the same edge never renders two
  // different paths depending on which layer drew it.
  function computeEdgeGeometry(edge: QuestTreeEdge): { d: string } | null {
    const from = edgeEndpoints.get(edge.fromTaskId);
    const to = edgeEndpoints.get(edge.toTaskId);
    if (!from || !to) return null;
    const sameTrader = laneTraderIndex.get(edge.fromTaskId) === laneTraderIndex.get(edge.toTaskId);
    const x1 = from.x + from.width / 2;
    const y1 = from.y + from.height;
    const x2 = to.x + to.width / 2;
    const y2 = to.y;
    return { d: buildEdgePath(x1, y1, x2, y2, sameTrader) };
  }

  // Ref (not state) guarding the one-time initial-position decision below,
  // separate from `initialViewport`'s own lazy `useState` seeding above:
  // that seeding already puts a restored session's `pan`/`zoom` in place
  // before the first paint, so this flag just needs to record "don't touch
  // `pan` again on this mount" for that case, and otherwise "have we
  // already resolved the fresh-session Mechanic jump (or its fallback)".
  // Starts `true` when `initialViewport` was provided so the effect below
  // never runs its jump/fallback logic on a restored mount.
  const hasRunInitialPositionRef = useRef(initialViewport !== null);

  // This component's one-time initial-position logic, guarded by
  // `hasRunInitialPositionRef` so it only ever moves `pan` once per mount
  // (a restored mount skips it entirely, per that ref's own doc comment
  // above). On a fresh mount, waits for `layout.lanes` to actually resolve
  // (task data loads asynchronously, so the very first render(s) can have
  // zero lanes) and then jumps straight to `AUTO_JUMP_TRADER_NAME`'s lane
  // via the same `computeTraderJumpPan` the "Jump to" toolbar buttons use,
  // falling back to the generic row-midpoint centering only if that trader
  // has no lane to jump to.
  //
  // Deliberately does NOT re-run on every later `layout.width` change (an
  // earlier version of this effect did, doubling as a "recenter after a
  // filter drastically resizes the layout" behavior): `layout.width` can
  // also shift for reasons that have nothing to do with the user's own
  // filter toggles, e.g. `useQuestAvailability` resolving a tick after
  // mount and reclassifying a few tasks as locked/available, and any such
  // incidental width change was overwriting this very jump moments after
  // it landed (this component's own `hasRunInitialPositionRef` guard was
  // already `true` by then, so that stale effect fell through to its
  // generic-center branch and stomped the jump). The real "recenter after
  // a filter changes what's visible" behavior now lives in its own effect
  // below, keyed on the actual filter toggles instead of `layout.width`.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (hasRunInitialPositionRef.current) return;
    if (layout.lanes.length === 0) return;
    hasRunInitialPositionRef.current = true;

    const autoJumpLane = layout.lanes.find((lane) => lane.traderName === AUTO_JUMP_TRADER_NAME);
    if (autoJumpLane) {
      setPan(computeTraderJumpPan(autoJumpLane, viewport.clientWidth, zoom));
      return;
    }
    setPan({ x: Math.max(0, (viewport.clientWidth - layout.width) / 2), y: 0 });
    // `zoom` is only read for its mount-time value (this whole branch is
    // guarded to run at most once by `hasRunInitialPositionRef`); listing
    // it would just make the linter ask for a dependency that must never
    // actually retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.lanes.length, layout.width]);

  // Holds the filter values as of the last time this effect actually ran,
  // seeded from the current render's values (not a sentinel) so the effect
  // below can tell "these are still what they were" apart from "the user
  // just flipped one". Seeding from the current values, rather than a
  // boolean "is this the first run" flag flipped inside the effect, matters
  // under React 18 Strict Mode: dev intentionally double-invokes every
  // effect once right after mount (setup, fake cleanup, setup again) to
  // catch effects that aren't resilient to it. A boolean flag flipped by
  // the first of those two invocations reads as already-flipped by the
  // second, mis-firing the recenter on every mount purely from the
  // strict-mode double-invoke, immediately stomping the initial-position
  // effect's Mechanic jump above with `(0, 0)` (an earlier version of this
  // effect used exactly that boolean pattern and hit this bug in practice,
  // even though production - where Strict Mode is a no-op - never would
  // have shown it). Comparing against values reseeded from the same render
  // is immune to it: both of the mount's double-invocations see
  // `prev === current` and skip identically.
  const lastFilterStateRef = useRef({ kappaOnly, showLocked });

  // Re-centers specifically when the user flips `kappaOnly` or
  // `showLocked`, either of which can drastically shrink or grow the
  // visible layout (e.g. `kappaOnly` hiding most lanes entirely), which
  // would otherwise leave a previously-panned viewport looking blank. Kept
  // as its own effect, separate from the initial-position one above and
  // keyed on the two real filter toggles rather than `layout.width` itself,
  // precisely so it can't also fire for incidental width changes that have
  // nothing to do with the user's own filter choice; see that effect's doc
  // comment for the bug this split fixes.
  useEffect(() => {
    const previous = lastFilterStateRef.current;
    const changed = previous.kappaOnly !== kappaOnly || previous.showLocked !== showLocked;
    lastFilterStateRef.current = { kappaOnly, showLocked };
    if (!changed) return;

    const viewport = viewportRef.current;
    if (!viewport) return;
    setPan({ x: Math.max(0, (viewport.clientWidth - layout.width) / 2), y: 0 });
    // Deliberately keyed on the filter toggles themselves, not `layout.width`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kappaOnly, showLocked]);

  // Reports the live viewport up to `QuestBoard` on every change so it can
  // hand this back as `initialViewport` if Tree is unmounted (tab switch)
  // and later remounted. See `QuestTreeViewProps.onViewportChange`'s doc
  // comment for why this lives in the parent's plain `useState` rather than
  // any persisted storage.
  useEffect(() => {
    onViewportChange?.({ pan, zoom });
  }, [pan, zoom, onViewportChange]);

  // Clears a pending jump-animation/highlight timeout on unmount so neither
  // fires its `setState` after this component is gone.
  useEffect(() => {
    return () => {
      if (jumpAnimationTimeoutRef.current !== null) clearTimeout(jumpAnimationTimeoutRef.current);
      if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

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
  // over the node buttons' text; it doesn't block their `onClick`, which
  // fires from mouseup independently of this.
  function handlePointerDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsPanning(true);

    // Applies each move as a delta on top of whatever `pan` is right now
    // (a functional update, not `startPan + totalDeltaSinceMousedown`),
    // since a wheel-zoom (`handleWheel`) can also call `setPan` mid-drag to
    // re-anchor the content under the cursor. The old "snapshot pan at
    // mousedown, add total mouse delta" approach ignored any such
    // in-between update, so the next mousemove would stomp it back,
    // discarding the zoom's anchor correction. That correction grows
    // sharply as zoom shrinks, so a few rapid scroll+drag frames could
    // fling the pan far off-screen almost instantly.
    function handleMove(moveEvent: globalThis.MouseEvent): void {
      setPan((prev) => ({
        x: prev.x + moveEvent.movementX,
        y: prev.y + moveEvent.movementY,
      }));
    }
    function handleUp(): void {
      setIsPanning(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  // Pans so `traderName`'s lane header lands at the viewport's top center
  // ("jump to the start of" that trader's chain) at the current zoom
  // level, via the shared `computeTraderJumpPan` (also used by the
  // initial-jump effect above). Animates the transition (`isJumpAnimating`
  // drives a temporary CSS `transition` on the pan/zoom layer, cleared
  // again after `JUMP_ANIMATION_MS`) instead of cutting instantly.
  // Deliberately not applied to drag-pan/wheel-zoom
  // (`handlePointerDown`/`handleWheel` never touch this flag), since those
  // need to track the pointer/wheel 1:1 every frame and would feel laggy
  // under a transition.
  function jumpToTrader(traderName: string): void {
    const lane = layout.lanes.find((entry) => entry.traderName === traderName);
    const viewport = viewportRef.current;
    if (!lane || !viewport) return;
    setPan(computeTraderJumpPan(lane, viewport.clientWidth, zoom));
    setIsJumpAnimating(true);
    if (jumpAnimationTimeoutRef.current !== null) clearTimeout(jumpAnimationTimeoutRef.current);
    jumpAnimationTimeoutRef.current = setTimeout(() => {
      setIsJumpAnimating(false);
      jumpAnimationTimeoutRef.current = null;
    }, JUMP_ANIMATION_MS);
  }

  // Finds the rendered box for `taskId` as it actually exists in `layout`
  // right now: a plain task node, or (only once expanded) an individual
  // part inside a chain node. Deliberately does not fall back to a
  // collapsed chain node's own box: `focusOnTask` below always expands the
  // chain first and re-runs via `pendingFocusTaskId` once that part has a
  // real position, so a collapsed-chain hit here would only ever be a
  // one-render transient this function's caller already knows to wait out.
  function findNodeForTask(
    taskId: string,
  ): { x: number; y: number; width: number; height: number } | null {
    for (const node of layout.nodes) {
      if (node.kind === "task") {
        if (node.taskId === taskId) return node;
        continue;
      }
      if (!node.expanded) continue;
      const part = node.parts.find((entry) => entry.taskId === taskId);
      if (part) return part;
    }
    return null;
  }

  // "Autozoom to the task" for a search-dropdown selection: jumps and
  // zooms to a fixed, comfortable reading level (`TASK_SEARCH_FOCUS_ZOOM`,
  // unlike `jumpToTrader`'s pan-only behavior) centered on the task, then
  // rings and pulses it (`highlightedTaskId`) for `TASK_FOCUS_HIGHLIGHT_MS`. If
  // the task is hidden inside a collapsed chain, expands that chain
  // instead of jumping immediately. If the task's node doesn't exist in
  // `layout` yet for any other reason (e.g. `QuestBoard` just switched to
  // this tab in the same click that sent the request, so game
  // data/availability hasn't resolved on this fresh mount), defers the
  // same way. Either case sets `pendingFocusTaskId`, whose retry effect
  // below re-attempts once `layout` actually contains that task's real
  // position.
  function focusOnTask(taskId: string): void {
    const chainId = chainIdByTaskId.get(taskId);
    if (chainId && !expandedChainIds.has(chainId)) {
      setExpandedChainIds((current) => new Set(current).add(chainId));
      setPendingFocusTaskId(taskId);
      return;
    }

    const node = findNodeForTask(taskId);
    const viewport = viewportRef.current;
    if (!node || !viewport) {
      setPendingFocusTaskId(taskId);
      return;
    }

    setZoom(TASK_SEARCH_FOCUS_ZOOM);
    setPan(
      computeTaskFocusPan(
        node,
        viewport.clientWidth,
        viewport.clientHeight,
        TASK_SEARCH_FOCUS_ZOOM,
      ),
    );
    setIsJumpAnimating(true);
    if (jumpAnimationTimeoutRef.current !== null) clearTimeout(jumpAnimationTimeoutRef.current);
    jumpAnimationTimeoutRef.current = setTimeout(() => {
      setIsJumpAnimating(false);
      jumpAnimationTimeoutRef.current = null;
    }, JUMP_ANIMATION_MS);

    setHighlightedTaskId(taskId);
    if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTaskId(null);
      highlightTimeoutRef.current = null;
    }, TASK_FOCUS_HIGHLIGHT_MS);
  }

  // Retries a focus deferred by `focusOnTask` above once the chain it
  // expanded has re-rendered `layout` with that part's real position.
  // Expanding a chain via `setExpandedChainIds` doesn't itself change
  // `layout` until the next render, so jumping in the same call that
  // triggered the expand would still read the stale, collapsed layout.
  useEffect(() => {
    if (pendingFocusTaskId === null) return;
    const node = findNodeForTask(pendingFocusTaskId);
    const viewport = viewportRef.current;
    if (!node || !viewport) return;
    setPendingFocusTaskId(null);
    focusOnTask(pendingFocusTaskId);
    // `layout` (not `pendingFocusTaskId` alone) is the real trigger here.
    // See the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocusTaskId, layout]);

  // Reacts to `QuestBoard` handing down a new search-dropdown selection.
  // `handledFocusNonceRef` is what makes this "new" precise: `focusRequest`
  // itself is never cleared back to `null` by the parent, so without it,
  // every unrelated re-render (zoom, pan, hover, ...) would re-run
  // `focusOnTask` against the same stale request forever.
  useEffect(() => {
    if (focusRequest === null) return;
    if (handledFocusNonceRef.current === focusRequest.nonce) return;
    handledFocusNonceRef.current = focusRequest.nonce;
    focusOnTask(focusRequest.taskId);
    // `focusOnTask` closes over plenty of state that changes far more often
    // than a new focus request should re-fire (`zoom`, `expandedChainIds`,
    // `layout`, ...). This effect intentionally only reacts to
    // `focusRequest` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const taskById = useMemo(
    () => new Map(visibleTasks.map((task) => [task.id, task])),
    [visibleTasks],
  );

  const collectorTaskId = useMemo(
    () => visibleTasks.find((task) => task.name === COLLECTOR_TASK_NAME)?.id ?? null,
    [visibleTasks],
  );

  // Collector's edges are hidden by default (`showCollectorLines`, toggled
  // via the eye icon rendered on its own node below); see
  // `COLLECTOR_TASK_NAME`'s doc comment for why. Filters both directions
  // (an edge either from or to Collector), then feeds every edge-consuming
  // render below (the SVG paths and the hover-only cross-trader labels) so
  // neither can show a Collector edge while it's toggled off.
  const visibleEdges = useMemo(
    () =>
      showCollectorLines || collectorTaskId === null
        ? layout.edges
        : layout.edges.filter(
            (edge) => edge.fromTaskId !== collectorTaskId && edge.toTaskId !== collectorTaskId,
          ),
    [layout.edges, showCollectorLines, collectorTaskId],
  );

  // First visible task per trader is enough: every task for a given trader
  // shares the same `trader.imageLink`, so there's no need to scan further.
  const traderImageByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const task of visibleTasks) {
      if (!map.has(task.trader.name)) map.set(task.trader.name, task.trader.imageLink);
    }
    return map;
  }, [visibleTasks]);

  // Decides between the full "Jump to" chip row and the collapsed
  // `JumpToTraderMenu` button: compares `jumpToMeasureRef`'s natural,
  // nowrap width (how much room every trader's avatar+name chip would need
  // laid out in one line) against `jumpToContainerRef`'s actual flexed
  // width (how much room the toolbar is actually giving that slot right
  // now). `useLayoutEffect`, not `useEffect`, so this resolves before the
  // browser paints the (possibly wrong) mode chosen on the previous
  // render, avoiding a one-frame flash of an overflowing chip row. Reruns
  // whenever the lane list changes shape (a new trader chip changes the
  // clone's natural width) and otherwise relies on the `ResizeObserver` for
  // window resizes / fullscreen toggles / legend collapses, none of which
  // change `layout.lanes` itself.
  useLayoutEffect(() => {
    const container = jumpToContainerRef.current;
    const measurer = jumpToMeasureRef.current;
    if (!container || !measurer) return;

    function checkOverflow(): void {
      if (!container || !measurer) return;
      setJumpToChipsOverflow(measurer.scrollWidth > container.clientWidth);
    }

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [layout.lanes]);

  if (!hasProfile) {
    return <NoActiveProfileNotice reason="view the quest tree" />;
  }

  const resolvedAvailability = availability ?? EMPTY_AVAILABILITY;

  // Counter-scales lane-header trader avatars against the canvas's own
  // `scale(zoom)` below `LANE_ICON_FREEZE_ZOOM` so their on-screen size
  // freezes instead of continuing to shrink. See that constant's doc
  // comment for why this can't grow unbounded.
  const laneIconScale = zoom < LANE_ICON_FREEZE_ZOOM ? LANE_ICON_FREEZE_ZOOM / zoom : 1;

  function isHoveredEdge(edgeTaskId: string): boolean {
    if (hoveredId === null) return false;
    return edgeTaskId === hoveredId || chainIdByTaskId.get(edgeTaskId) === hoveredId;
  }

  // Shared by the real "Jump to" chip row and its hidden measurement clone
  // (see the `useLayoutEffect` above) so the two can never drift apart into
  // measuring one thing and rendering another.
  function renderTraderChip(lane: QuestTreeLane) {
    const traderImage = traderImageByName.get(lane.traderName);
    return (
      <button
        key={lane.traderName}
        type="button"
        className="hover:bg-accent flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
        style={{ borderColor: getTraderOutlineColor(lane.traderName) }}
        onClick={() => {
          jumpToTrader(lane.traderName);
        }}
      >
        {traderImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
          <img src={traderImage} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="bg-muted h-4 w-4 shrink-0 rounded-full" />
        )}
        {lane.traderName}
      </button>
    );
  }

  return (
    <div
      ref={setWrapperNode}
      // `-mb-4` cancels `ProgressTrackerPage`'s own trailing `py-4` (16px)
      // bottom padding (mirrors `-ml-[50vw]`/`w-screen` canceling that same
      // page's horizontal `max-w-[1600px]`/`px-4`). Without it,
      // `wrapperHeight` filling to the viewport's bottom edge would still
      // leave a 16px gap below the map, since that padding sits below this
      // component's own subtree and renders after it regardless of this
      // wrapper's own height. Negative margin, not zero padding: the page
      // container's `py-4` is shared by every other tab on this page too,
      // so it can't just be removed there, only canceled locally, here,
      // for the one tab that wants to go fully flush.
      //
      // `h-[calc(100vh-13rem)]` is only the pre-measurement fallback shown
      // for the first frame before the effect above measures the wrapper's
      // real distance from the viewport top and overrides it via the
      // `style` prop below; it approximates the page's now-compact chrome
      // (site header + trimmed title + tab rows) rather than being load
      // bearing on its own.
      className="bg-background relative left-1/2 -mb-4 -ml-[50vw] flex h-[calc(100vh-13rem)] w-screen flex-col gap-3"
      style={wrapperHeight !== null ? { height: wrapperHeight } : undefined}
    >
      <div
        className={`flex shrink-0 flex-wrap items-center gap-3 px-4 text-sm ${isFullscreen ? "pt-4" : ""}`}
      >
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
          // `flex-1 min-w-0` (not a plain flex item sized to its content)
          // so this slot's own width comes purely from the flex row's
          // leftover space after the checkboxes/zoom controls, and stays
          // stable regardless of whether the chip row or the collapsed
          // `JumpToTraderMenu` renders inside it below - if the slot's own
          // width could change with what's inside it, that'd feed back into
          // the overflow measurement effect and could thrash between modes.
          <div ref={jumpToContainerRef} className="relative flex min-w-0 flex-1 items-center">
            {/* Hidden clone of the full, unwrapped chip row, purely to
                measure how much width it needs at its natural size -
                absolutely positioned and `invisible` (not `hidden`/
                unmounted) so it never affects layout or paints, but still
                has a real `scrollWidth` to read (a `display: none` node's
                size can't be measured at all, which is why the toggled
                real content below can't double as its own measurement). */}
            <div
              ref={jumpToMeasureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute top-0 left-0 flex flex-nowrap items-center gap-1.5 whitespace-nowrap"
            >
              <span className="text-muted-foreground text-xs">Jump to:</span>
              {layout.lanes.map((lane) => renderTraderChip(lane))}
            </div>

            {jumpToChipsOverflow ? (
              <JumpToTraderMenu
                lanes={layout.lanes}
                traderImageByName={traderImageByName}
                onJump={jumpToTrader}
              />
            ) : (
              // `overflow-clip`, not `overflow-hidden`: the pannable canvas
              // viewport below is found in tests via
              // `container.querySelector(".overflow-hidden")`, and this
              // toolbar row renders earlier in the DOM, so reusing that
              // exact class here would make that query match this row
              // instead. Functionally the two clip identically for this
              // non-scrolling row.
              <div className="flex flex-nowrap items-center gap-1.5 overflow-clip">
                <span className="text-muted-foreground text-xs">Jump to:</span>
                {layout.lanes.map((lane) => renderTraderChip(lane))}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP));
            }}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground w-12 text-center text-xs">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP));
            }}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setZoom(1);
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen (F)"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mouse-only pan/zoom canvas (drag-to-pan, wheel-to-zoom). The
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
              // Only animated for a "Jump to" trader button's pan
              // (`jumpToTrader` toggles `isJumpAnimating`). Drag-pan and
              // wheel-zoom update `pan`/`zoom` every frame and would feel
              // laggy under a transition, so both leave this flag untouched.
              transition: isJumpAnimating
                ? `transform ${String(JUMP_ANIMATION_MS)}ms ease-in-out`
                : "none",
            }}
          >
            {/* Loyalty-tier row bands, painted first so everything else
                (edges, nodes, lane headers) sits visually on top. Lives in
                the same pan/zoom coordinate space as nodes (absolute,
                layout.width-wide), so it pans/zooms with content instead of
                staying fixed to the viewport. Each band reserves a real
                `ROW_HEADER_HEIGHT`-tall title strip at its own top
                (`computeQuestTreeLayout`'s `rowHeaderHeight` option already
                pushed every node in the row down to clear it, the same
                "reserve space, don't float over content" principle
                `laneHeaderHeight` uses for lane headers), so the label can
                never overlap a node the way a floating inset badge would.
                Colored semantically (essential = amber, unconfirmed = dim
                neutral, LL1-4 = a plain uniform tint) rather than an
                alternating stripe, matching `QuestSwimlaneMatrix`'s row
                headers so all three board views share one visual language. */}
            {layout.rows.map((row) => {
              const bucket = LOYALTY_BUCKET_ORDER[row.layer] ?? "unconfirmed";
              const isEssential = bucket === "essential";
              const isUnconfirmed = bucket === "unconfirmed";
              const taskCount = rowTaskCounts.get(row.layer) ?? 0;
              return (
                <div
                  key={row.layer}
                  className={`pointer-events-none absolute left-0 border-t-2 ${
                    isEssential
                      ? "border-status-amber bg-status-amber-soft/25"
                      : isUnconfirmed
                        ? "border-border/60 bg-muted/20"
                        : "border-border/60 bg-muted/10"
                  }`}
                  style={{ top: row.y, width: layout.width, height: row.height }}
                >
                  <div
                    className={`flex items-center gap-2 px-3 text-xs font-bold tracking-wide uppercase ${
                      isEssential
                        ? "bg-status-amber-soft text-status-amber"
                        : "bg-card/80 text-foreground"
                    }`}
                    style={{ height: ROW_HEADER_HEIGHT }}
                  >
                    <span>{loyaltyBucketLabel(bucket)}</span>
                    <span className="text-muted-foreground font-mono text-[10px] font-normal">
                      {taskCount} {taskCount === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                </div>
              );
            })}

            <svg
              className="pointer-events-none absolute top-0 left-0"
              width={layout.width}
              height={layout.height}
            >
              {/* Punches an opaque hole for every node's box out of the
                  edges drawn below, so an edge that merely routes behind a
                  node (not just its own endpoints) never bleeds through that
                  node's translucent background. See this component's doc
                  comment. */}
              <defs>
                <mask
                  id={nodeMaskId}
                  maskUnits="userSpaceOnUse"
                  x={0}
                  y={0}
                  width={layout.width}
                  height={layout.height}
                >
                  <rect x={0} y={0} width={layout.width} height={layout.height} fill="white" />
                  {layout.nodes.map((node) => (
                    <rect
                      key={node.kind === "task" ? node.taskId : node.chainId}
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      fill="black"
                    />
                  ))}
                </mask>
              </defs>
              <g mask={`url(#${nodeMaskId})`}>
                {visibleEdges.map((edge) => {
                  const geometry = computeEdgeGeometry(edge);
                  if (!geometry) return null;
                  const isHovered = isHoveredEdge(edge.fromTaskId) || isHoveredEdge(edge.toTaskId);
                  return (
                    <path
                      key={`${edge.fromTaskId}->${edge.toTaskId}`}
                      d={geometry.d}
                      strokeWidth={isHovered ? 3 : 1.25}
                      className={`fill-none transition-colors ${isHovered ? "stroke-primary" : "stroke-border"}`}
                    />
                  );
                })}
              </g>
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
                      style={{
                        outlineColor: getTraderOutlineColor(lane.traderName),
                        transform: `scale(${String(laneIconScale)})`,
                        // Bottom-anchored: growth pushes up into the empty
                        // space above the lane header (nothing sits there)
                        // instead of down into the trader name label / tasks.
                        transformOrigin: "50% 100%",
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bg-muted h-16 w-16 shrink-0 rounded-full outline-2 outline-offset-1"
                      style={{
                        outlineColor: getTraderOutlineColor(lane.traderName),
                        transform: `scale(${String(laneIconScale)})`,
                        // Bottom-anchored: growth pushes up into the empty
                        // space above the lane header (nothing sits there)
                        // instead of down into the trader name label / tasks.
                        transformOrigin: "50% 100%",
                      }}
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
                const isCollector = node.taskId === collectorTaskId;
                return (
                  <Fragment key={node.taskId}>
                    <button
                      type="button"
                      className={`absolute flex cursor-pointer flex-col items-center justify-center rounded-md border-2 p-2 text-center text-xs shadow-sm outline-2 outline-offset-1 transition-transform hover:scale-[1.03] ${STATUS_NODE_CLASS[statusKey] ?? ""} ${
                        selectedTaskId === node.taskId ? "ring-ring ring-2" : ""
                      } ${highlightedTaskId === node.taskId ? "ring-primary animate-pulse ring-4" : ""}`}
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
                      <span className="max-w-full truncate font-medium">{task.name}</span>
                      <span className="text-muted-foreground mt-1 max-w-full truncate">
                        {task.trader.name} · Lv {task.minPlayerLevel}
                      </span>
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
                    {isCollector && (
                      // A sibling of the node button, not nested inside it
                      // (a `<button>` can't legally contain another).
                      // Positioned in the same pan/zoom-layer coordinate
                      // space via `node.x`/`node.y` directly, offset up-left
                      // so it doesn't collide with the kappa-key badge
                      // above's own top-right corner placement.
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowCollectorLines((current) => !current);
                        }}
                        aria-label={
                          showCollectorLines
                            ? "Hide Collector's prerequisite lines"
                            : "Show Collector's prerequisite lines"
                        }
                        title={
                          showCollectorLines
                            ? "Hide prerequisite lines"
                            : "Show prerequisite lines (many quests feed into Collector)"
                        }
                        className="bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary absolute z-10 flex items-center justify-center rounded-full border shadow-sm transition-colors"
                        style={{ left: node.x - 10, top: node.y - 10, width: 22, height: 22 }}
                      >
                        {showCollectorLines ? (
                          <Eye className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </Fragment>
                );
              }

              const statusKey = aggregateChainStatus(node, resolvedAvailability);

              if (!node.expanded) {
                // A collapsed chain bundles 2+ real tasks into one node
                // (see `detectQuestChains`). One `aria-hidden` ghost card
                // per extra part (via `computeChainStackOffsets`,
                // furthest-first) renders behind the real button, each
                // offset a few px further down-and-right, so an N-part
                // chain shows N total cards as a "this is actually a
                // stack" cue. Identical size, increasing offset, and
                // back-to-front paint order mean each nearer layer's
                // opaque `bg-card` fill naturally covers the farther
                // layer's non-visible top-left border, so only each
                // ghost's true bottom-right sliver ever shows; no
                // `clip-path` needed.
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
                      } ${highlightedTaskId !== null && node.taskIds.includes(highlightedTaskId) ? "ring-primary animate-pulse ring-4" : ""}`}
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
                      <span className="max-w-full truncate font-medium">{node.baseName}</span>
                      <span className="text-muted-foreground mt-1 max-w-full truncate">
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
                    <span aria-hidden="true" className="whitespace-nowrap">
                      ▴ collapse
                    </span>
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
                        } ${highlightedTaskId === part.taskId ? "ring-primary animate-pulse ring-4" : ""}`}
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

            {/* Hover-reveal layer: unlike the masked edges `<svg>` above
                (which hides any segment passing under a node's box so the
                graph never reads as lines "stabbing through" cards at
                rest), this one paints after every node button above with
                no mask, so the currently-hovered edge(s) stay fully
                traceable even where their path crosses behind a node they
                don't connect to. Only ever renders the hovered edge(s);
                every other edge stays clipped by the masked layer
                underneath. */}
            <svg
              className="pointer-events-none absolute top-0 left-0"
              width={layout.width}
              height={layout.height}
            >
              {visibleEdges.map((edge) => {
                const isHovered = isHoveredEdge(edge.fromTaskId) || isHoveredEdge(edge.toTaskId);
                if (!isHovered) return null;
                const geometry = computeEdgeGeometry(edge);
                if (!geometry) return null;
                return (
                  <path
                    key={`${edge.fromTaskId}->${edge.toTaskId}`}
                    d={geometry.d}
                    strokeWidth={3}
                    className="stroke-primary fill-none"
                  />
                );
              })}
            </svg>

            {/* Hover-only cross-trader edge labels. Painted after every
                node above (position:absolute siblings paint in DOM order,
                no z-index needed) so they sit on top. Same-trader "elbow"
                edges skip labeling entirely (their short, adjacent-lane
                path is already easy to trace by eye). */}
            {visibleEdges.map((edge) => {
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

        {legendCollapsed ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              setLegendCollapsed(false);
            }}
            aria-label="Show legend"
            title="Show legend"
            className="bg-card/95 absolute top-3 right-3 z-10 shadow-lg backdrop-blur-sm"
          >
            <Info className="h-4 w-4" />
          </Button>
        ) : (
          <div className="border-border bg-card/95 pointer-events-none absolute top-3 right-3 z-10 flex max-w-64 flex-col gap-2 rounded-lg border p-3 text-xs shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground font-semibold">Legend</span>
              <button
                type="button"
                onClick={() => {
                  setLegendCollapsed(true);
                }}
                aria-label="Hide legend"
                title="Hide legend"
                className="text-muted-foreground hover:text-foreground pointer-events-auto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

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
        )}
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
