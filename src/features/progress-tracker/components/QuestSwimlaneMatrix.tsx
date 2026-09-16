"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useGameDataBannerVisible } from "@/shared/lib/tarkov-api/use-game-data-banner-visible";
import { taskMatchesQuery } from "@/shared/lib/task-search";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { useSiteStatusBannerVisible } from "@/shared/ui/site-status-banner/use-site-status-banner-visible";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { useQuestAvailability } from "../hooks/use-quest-availability";
import { detectQuestChains } from "../lib/quest-chains";
import { TASK_FOCUS_HIGHLIGHT_MS } from "../lib/task-focus-request";
import {
  buildLoyaltyBoard,
  loyaltyBucketLabel,
  LOYALTY_BUCKET_ORDER,
} from "../selectors/loyalty-board";
import { getTraderOutlineColor, sortTraderNames } from "../selectors/trader-grouping";

import { NoActiveProfileNotice } from "./NoActiveProfileNotice";
import { QuestChainStack } from "./QuestChainStack";
import { QuestDetailDialog } from "./QuestDetailDialog";
import { QuestTaskChip } from "./QuestTaskChip";

import type { QuestChain } from "../lib/quest-chains";
import type { TaskFocusRequest } from "../lib/task-focus-request";
import type { LoyaltyBucket } from "../selectors/loyalty-board";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

/** One matrix cell's contents in render order: either a standalone task, or a detected multi-part chain (2+ of whose parts landed in this same cell) collapsed into one `QuestChainStack`. */
type CellItem = { kind: "task"; task: NormalizedTask } | { kind: "chain"; chain: QuestChain };

/** A cell renders at most this many items before collapsing the rest behind a "+N more" toggle, so one dense cell (see `cellKey`'s doc comment) can't stretch its whole grid row for every trader in it. */
const CELL_COLLAPSE_THRESHOLD = 6;

/** Identifies one trader/bucket cell for `expandedCellKeys`, `::` being a separator no real trader name or `LoyaltyBucket` value contains. */
function cellKey(traderName: string, bucket: LoyaltyBucket): string {
  return `${traderName}::${String(bucket)}`;
}

/**
 * Groups a cell's flat task list into `CellItem`s, folding a detected
 * chain's members into one `"chain"` item wherever 2+ of them landed in this
 * same cell (e.g. "Small Business - Part 1/2/3" all sitting in the same
 * trader/tier bucket). A chain with only one member here (its other parts
 * fell into a different bucket, or were filtered out) renders as a plain
 * task instead: a "stack" of one isn't a stack, and it'd otherwise hide a
 * task's real per-part detail (level, kappa badge) behind an unnecessary
 * click. Preserves each item's first-occurrence position in `tasks`, same
 * order the plain flat render used before.
 */
function groupCellItems(
  tasks: readonly NormalizedTask[],
  chainByTaskId: ReadonlyMap<string, QuestChain>,
): CellItem[] {
  const taskIdsInCell = new Set(tasks.map((task) => task.id));
  const addedChainIds = new Set<string>();
  const items: CellItem[] = [];
  for (const task of tasks) {
    const chain = chainByTaskId.get(task.id);
    const memberCountInCell = chain
      ? chain.taskIds.filter((taskId) => taskIdsInCell.has(taskId)).length
      : 0;
    if (chain && memberCountInCell >= 2) {
      if (addedChainIds.has(chain.chainId)) continue;
      addedChainIds.add(chain.chainId);
      items.push({ kind: "chain", chain });
    } else {
      items.push({ kind: "task", task });
    }
  }
  return items;
}

export interface QuestSwimlaneMatrixProps {
  /** Free-text search from `QuestBoard`'s toolbar. Defaults to "" so this renders standalone (e.g. in tests). */
  searchQuery?: string;
  /** Set by `QuestBoard` when the user clicks a result in its search dropdown, only while Matrix is the active tab. See `TaskFocusRequest`'s own doc comment and `focusOnTask` below for how Matrix reacts to it. */
  focusRequest?: TaskFocusRequest | null;
}

/**
 * Trader-columns x loyalty-tier-rows board: the new default view mode of
 * `QuestBoard`. Every currently-visible task's cell comes from
 * `resolveLoyaltyBoardEntry` (via `buildLoyaltyBoard`), the same resolver
 * `QuestTreeView`'s row bands use, so the two board views agree on
 * placement. The Essential row and the Unconfirmed row
 * are real rows here, not hidden away, since roughly 80% of live tasks
 * currently fall into Unconfirmed pending more curated screenshots (see
 * `data/loyalty-board-overrides.ts`).
 *
 * Only the horizontal axis scrolls inside the body wrapper
 * (`containerRef`, `overflow-x-auto`, no explicit height): the grid
 * otherwise grows to its natural height so the page's own scrollbar handles
 * the vertical axis instead of a second, competing one. Row headers (tier
 * label) stick at `left-0` inside that same wrapper, matching a typical
 * roadmap/swimlane board, since that axis genuinely scrolls there.
 *
 * Column headers (trader avatar + name) are trickier: they can't just be
 * `position: sticky` cells inside that same `overflow-x-auto` wrapper, even
 * though the tier-label column manages it. Giving an element `overflow-x:
 * auto` makes the CSS Overflow spec compute its `overflow-y` up to `auto`
 * too (an ancestor's overflow being non-`visible` on *either* axis is enough
 * to make it a scroll container for *both*), which makes it, not the page,
 * the nearest scrolling ancestor for any sticky descendant. Since this
 * wrapper's height is never constrained, its own vertical "scrollport" never
 * actually moves (`scrollTop` stays 0 forever, the page scrolls past it
 * instead), so a `top`-stuck child inside it has nothing to react to and
 * just scrolls away with the content, confirmed by hand before landing this
 * (see the branch's PR discussion). The tier-label column is unaffected
 * because it sticks to `left`, the one axis this wrapper actually does
 * scroll natively.
 *
 * So the header row lives in its own sibling strip instead: a `sticky`
 * wrapper (just under the site's own sticky `Header`, `h-14`, see
 * `shared/ui/header/Header.tsx`, further down by any visible
 * `SiteStatusBanner`/`GameDataStatusBanner` strip, each `h-9` and neither
 * itself sticky, per `top`'s own inline-style comment below) with no
 * `overflow` of its own, making the real page the nearest scrolling ancestor
 * for its stickiness, containing an inner `overflow-hidden` box
 * (`headerScrollRef`) whose `scrollLeft` the
 * body's `onScroll` mirrors every frame, the standard "frozen header row"
 * trick every data-grid with independent horizontal/vertical scrolling uses.
 * Both grids share one `gridTemplateColumns` string so their columns compute
 * to identical pixel widths without either needing to know the other's
 * exact width (both are plain 100%-width block children of the same flex
 * column).
 *
 * Each cell renders at most `CELL_COLLAPSE_THRESHOLD` items before
 * collapsing the rest behind a "+N more" toggle (`expandedCellKeys`) rather
 * than an internal `overflow-y-auto` scrollbar: with roughly 80% of tasks
 * currently landing in Unconfirmed (see below), an uncapped cell in an
 * unevenly distributed row could otherwise stretch that whole grid row (and
 * every other trader's cell in it) to match its tallest neighbor.
 *
 * A detected multi-part chain (e.g. "Small Business - Part 1/2/3", see
 * `detectQuestChains`) with 2+ members in the same cell collapses into one
 * `QuestChainStack` instead of listing each part as its own flat chip
 * (`groupCellItems` above), the same "this is actually a stack" cue
 * `QuestTreeView`'s collapsed chain nodes use. Each chain's expanded/
 * collapsed state lives here (`expandedChainIds`), not inside
 * `QuestChainStack` itself, so a search-dropdown jump targeting a part
 * inside a still-collapsed chain can force it open the same way
 * `QuestTreeView.expandedChainIds` does (`focusOnTask` below).
 *
 * A search-dropdown selection (`focusRequest`, only acted on while Matrix is
 * the active tab) scrolls that task's chip into view and rings/pulses it for
 * `TASK_FOCUS_HIGHLIGHT_MS`, via a plain `container.querySelector`
 * (`data-task-id`, see `QuestTaskChip`) rather than a ref-per-chip map:
 * simpler than Tree's canvas-coordinate math since the browser's own layout
 * already knows where everything is. Mirrors Tree's own
 * `pendingFocusTaskId` retry: if the chip doesn't exist yet (task inside a
 * chain that still needs expanding first, or `visibleTasks` hasn't resolved
 * on a fresh mount), the request is retried once the DOM actually contains
 * it.
 */
export function QuestSwimlaneMatrix({
  searchQuery = "",
  focusRequest = null,
}: QuestSwimlaneMatrixProps) {
  const { tasks: tasksData } = useActiveModeTasks();
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();
  const availability = useQuestAvailability();
  // Site header (`h-14`) plus one `h-9` per visible banner strip, same
  // `visibleBannerCount` pattern `MapsPage` uses for its own header-relative
  // sizing: neither banner is itself sticky, so this sticky header would
  // otherwise stick at a fixed `top-14` and briefly overlap a still-visible
  // banner while the page scrolls past it. See the doc comment above.
  const visibleBannerCount =
    (useGameDataBannerVisible() ? 1 : 0) + (useSiteStatusBannerVisible() ? 1 : 0);
  const [showLocked, setShowLocked] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedChainIds, setExpandedChainIds] = useState<ReadonlySet<string>>(new Set());
  const [expandedCellKeys, setExpandedCellKeys] = useState<ReadonlySet<string>>(new Set());
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [pendingFocusTaskId, setPendingFocusTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const handledFocusNonceRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleTasks = useMemo(() => {
    const allTasks = tasksData ?? [];
    if (!availability) return [];
    const lockFiltered = showLocked
      ? allTasks
      : allTasks.filter((task) => availability.get(task.id)?.isLocked !== true);
    return lockFiltered.filter((task) => taskMatchesQuery(task, searchQuery));
  }, [tasksData, availability, showLocked, searchQuery]);

  const board = useMemo(() => buildLoyaltyBoard(visibleTasks), [visibleTasks]);

  const traders = useMemo(
    () => sortTraderNames([...new Set(visibleTasks.map((task) => task.trader.name))]),
    [visibleTasks],
  );

  // trader name -> bucket -> tasks in that cell.
  const cellsByTrader = useMemo(() => {
    const cells = new Map<string, Map<LoyaltyBucket, NormalizedTask[]>>();
    for (const traderName of traders) {
      cells.set(traderName, new Map(LOYALTY_BUCKET_ORDER.map((bucket) => [bucket, []])));
    }
    for (const task of visibleTasks) {
      const entry = board.get(task.id);
      if (!entry) continue;
      cells.get(task.trader.name)?.get(entry.bucket)?.push(task);
    }
    return cells;
  }, [traders, visibleTasks, board]);

  const chainByTaskId = useMemo(() => {
    const map = new Map<string, QuestChain>();
    for (const chain of detectQuestChains(visibleTasks)) {
      for (const taskId of chain.taskIds) map.set(taskId, chain);
    }
    return map;
  }, [visibleTasks]);

  const taskById = useMemo(() => {
    const map = new Map<string, NormalizedTask>();
    for (const task of visibleTasks) map.set(task.id, task);
    return map;
  }, [visibleTasks]);

  // task id -> its cell key, so `focusOnTask` can expand a "+N more"
  // collapsed cell before looking for the task's chip, the same way it
  // expands a collapsed chain first.
  const cellKeyByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of visibleTasks) {
      const entry = board.get(task.id);
      if (!entry) continue;
      map.set(task.id, cellKey(task.trader.name, entry.bucket));
    }
    return map;
  }, [visibleTasks, board]);

  // trader name -> bucket -> that cell's tasks, chain-grouped.
  const cellItemsByTrader = useMemo(() => {
    const cells = new Map<string, Map<LoyaltyBucket, CellItem[]>>();
    for (const [traderName, byBucket] of cellsByTrader) {
      const grouped = new Map<LoyaltyBucket, CellItem[]>();
      for (const [bucket, tasks] of byBucket) {
        grouped.set(bucket, groupCellItems(tasks, chainByTaskId));
      }
      cells.set(traderName, grouped);
    }
    return cells;
  }, [cellsByTrader, chainByTaskId]);

  const traderImageByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const task of tasksData ?? []) {
      if (!map.has(task.trader.name)) map.set(task.trader.name, task.trader.imageLink);
    }
    return map;
  }, [tasksData]);

  function toggleChainExpanded(chainId: string): void {
    setExpandedChainIds((current) => {
      const next = new Set(current);
      if (next.has(chainId)) next.delete(chainId);
      else next.add(chainId);
      return next;
    });
  }

  function toggleCellExpanded(key: string): void {
    setExpandedCellKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // "Bring this task into view" for a search-dropdown selection: expands its
  // chain first if it's hidden inside a still-collapsed `QuestChainStack`
  // (deferring via `pendingFocusTaskId`, since expanding the chain doesn't
  // itself repaint the DOM node this same call would otherwise look for),
  // otherwise scrolls its real chip into view and rings/pulses it for
  // `TASK_FOCUS_HIGHLIGHT_MS`. `container.querySelector` (not a ref map)
  // finds the chip: every `QuestTaskChip` carries `data-task-id`, and at any
  // moment at most one is ever rendered for a given task id (a chain's
  // collapsed button doesn't carry one at all, so it can never collide with
  // its own expanded parts).
  //
  // The chain-expand branch adds directly to `expandedChainIds` rather than
  // going through `toggleChainExpanded`: the retry effect below calls this
  // function again once the expand commits, and a *toggle* would flip the
  // chain straight back to collapsed on that second call (an idempotent add
  // is what `QuestTreeView`'s own equivalent expand-to-focus branch uses,
  // for the same reason).
  function focusOnTask(taskId: string): void {
    const chain = chainByTaskId.get(taskId);
    if (chain && !expandedChainIds.has(chain.chainId)) {
      const chainId = chain.chainId;
      setExpandedChainIds((current) => new Set(current).add(chainId));
      setPendingFocusTaskId(taskId);
      return;
    }

    const key = cellKeyByTaskId.get(taskId);
    if (key && !expandedCellKeys.has(key)) {
      setExpandedCellKeys((current) => new Set(current).add(key));
      setPendingFocusTaskId(taskId);
      return;
    }

    const chip = containerRef.current?.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`);
    if (!chip) {
      setPendingFocusTaskId(taskId);
      return;
    }

    setPendingFocusTaskId(null);
    // `typeof` check, not optional chaining: the DOM lib types declare
    // `scrollIntoView` as always present, so `?.()` is flagged as an
    // unnecessary chain even though jsdom (the test environment) genuinely
    // doesn't implement it at runtime.
    if (typeof chip.scrollIntoView === "function") {
      chip.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
    setHighlightedTaskId(taskId);
    if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTaskId(null);
      highlightTimeoutRef.current = null;
    }, TASK_FOCUS_HIGHLIGHT_MS);
  }

  // Retries a focus deferred by `focusOnTask` above by simply calling it
  // again: `focusOnTask` itself already knows how to tell "still need to
  // expand a chain first" apart from "still need to expand a collapsed cell"
  // apart from "just need the chip to exist" apart from "done" (and manages
  // `pendingFocusTaskId` accordingly in every branch), so the retry doesn't
  // need to duplicate any of that decision - only re-trigger it whenever
  // something that could unblock it changes. The `containerRef.current`
  // guard is a genuine "is the viewport actually mounted yet" check, same as
  // `QuestTreeView`'s equivalent `viewportRef` guard.
  useEffect(() => {
    if (pendingFocusTaskId === null) return;
    if (!containerRef.current) return;
    focusOnTask(pendingFocusTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingFocusTaskId,
    chainByTaskId,
    expandedChainIds,
    cellKeyByTaskId,
    expandedCellKeys,
    cellItemsByTrader,
  ]);

  // Reacts to `QuestBoard` handing down a new search-dropdown selection.
  // `handledFocusNonceRef` is what makes this "new" precise: `focusRequest`
  // itself is never cleared back to `null` by the parent, so without it,
  // every unrelated re-render would re-run `focusOnTask` against the same
  // stale request forever.
  useEffect(() => {
    if (focusRequest === null) return;
    if (handledFocusNonceRef.current === focusRequest.nonce) return;
    handledFocusNonceRef.current = focusRequest.nonce;
    focusOnTask(focusRequest.taskId);
    // `focusOnTask` closes over plenty of state that changes far more often
    // than a new focus request should re-fire. This effect intentionally
    // only reacts to `focusRequest` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  // Clears a pending highlight timeout on unmount so it can't fire a
  // `setState` after this component is gone.
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  if (!progress || activeFaction === undefined || !availability) {
    return <NoActiveProfileNotice reason="view the quest board" />;
  }

  // Shared by the header strip's grid and the body's grid below so their
  // columns compute to the same pixel widths (both are plain 100%-width
  // block children of the same flex column, so `1fr` resolves identically
  // in each) without either one needing to know the other's exact width.
  const gridTemplateColumns = `180px repeat(${String(traders.length)}, minmax(230px, 1fr))`;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox
          checked={showLocked}
          onChange={(event) => {
            setShowLocked(event.target.checked);
          }}
        />
        Show locked
      </label>

      <div
        className="sticky z-20"
        // Inline style, not a Tailwind arbitrary-value class: the offset
        // depends on `visibleBannerCount`, a runtime value, and Tailwind's
        // JIT scanner only picks up class names that appear literally in
        // source (same constraint `MapsPage`'s own doc comment calls out for
        // its precomputed banner-count classes). `calc()` supports
        // multiplying a length by a plain number, so this stays one
        // expression rather than three precomputed literal strings.
        style={{ top: `calc(3.5rem + ${String(visibleBannerCount)} * 2.25rem)` }}
      >
        <div
          ref={headerScrollRef}
          className="border-border overflow-hidden rounded-t-lg border-x border-t"
        >
          <div className="grid" style={{ gridTemplateColumns }}>
            <div className="bg-muted border-border sticky left-0 z-20 border-r border-b" />
            {traders.map((traderName) => {
              const traderImage = traderImageByName.get(traderName) ?? null;
              return (
                <div
                  key={traderName}
                  className="bg-muted border-border flex items-center gap-2 border-r border-b p-2"
                >
                  {traderImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                    <img
                      src={traderImage}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover outline-2 outline-offset-1"
                      style={{ outlineColor: getTraderOutlineColor(traderName) }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="bg-card h-8 w-8 shrink-0 rounded-full outline-2 outline-offset-1"
                      style={{ outlineColor: getTraderOutlineColor(traderName) }}
                    />
                  )}
                  <span className="truncate text-sm font-medium">{traderName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="border-border overflow-x-auto rounded-b-lg border-x border-b"
        onScroll={(event) => {
          if (headerScrollRef.current)
            headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div className="grid" style={{ gridTemplateColumns }}>
          {LOYALTY_BUCKET_ORDER.map((bucket) => (
            <div key={bucket} className="contents">
              <div
                className={`border-border sticky left-0 z-10 flex flex-col justify-center border-r border-b p-2 text-xs font-medium tracking-wide uppercase ${
                  bucket === "essential"
                    ? "bg-muted text-status-amber"
                    : bucket === "unconfirmed"
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted"
                }`}
              >
                {loyaltyBucketLabel(bucket)}
              </div>
              {traders.map((traderName) => {
                const cellItems = cellItemsByTrader.get(traderName)?.get(bucket) ?? [];
                const key = cellKey(traderName, bucket);
                const isExpanded = expandedCellKeys.has(key);
                const visibleItems = isExpanded
                  ? cellItems
                  : cellItems.slice(0, CELL_COLLAPSE_THRESHOLD);
                const hiddenCount = cellItems.length - visibleItems.length;
                return (
                  <div
                    key={traderName}
                    className={`border-border border-r border-b p-2 ${
                      bucket === "essential" ? "bg-status-amber-soft/30" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-1.5">
                      {visibleItems.map((item) =>
                        item.kind === "chain" ? (
                          <QuestChainStack
                            key={item.chain.chainId}
                            chain={item.chain}
                            tasksById={taskById}
                            availability={availability}
                            selectedTaskId={selectedTaskId}
                            onSelect={setSelectedTaskId}
                            highlightedTaskId={highlightedTaskId}
                            expanded={expandedChainIds.has(item.chain.chainId)}
                            onToggleExpanded={() => {
                              toggleChainExpanded(item.chain.chainId);
                            }}
                          />
                        ) : (
                          <QuestTaskChip
                            key={item.task.id}
                            task={item.task}
                            availability={availability.get(item.task.id)}
                            selected={selectedTaskId === item.task.id}
                            onSelect={setSelectedTaskId}
                            highlighted={highlightedTaskId === item.task.id}
                          />
                        ),
                      )}
                    </div>
                    {cellItems.length > CELL_COLLAPSE_THRESHOLD && (
                      <button
                        type="button"
                        onClick={() => {
                          toggleCellExpanded(key);
                        }}
                        className="text-muted-foreground hover:text-foreground mt-1.5 text-xs font-medium hover:underline"
                      >
                        {isExpanded ? "Show less" : `+${String(hiddenCount)} more`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
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
