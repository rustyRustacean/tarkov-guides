"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { taskMatchesQuery } from "@/shared/lib/task-search";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { useQuestAvailability } from "../hooks/use-quest-availability";
import { useTaskActions } from "../hooks/use-task-actions";
import { TASK_FOCUS_HIGHLIGHT_MS } from "../lib/task-focus-request";
import {
  buildLoyaltyBoard,
  loyaltyBucketLabel,
  LOYALTY_BUCKET_ORDER,
} from "../selectors/loyalty-board";
import { getTraderOutlineColor, sortTraderNames } from "../selectors/trader-grouping";
import { useProgressTrackerStore } from "../store";

import { NoActiveProfileNotice } from "./NoActiveProfileNotice";
import { statusBadge } from "./QuestCard";
import { QuestDetailSections, TaskBadges } from "./QuestDetailDialog";

import type { TaskFocusRequest } from "../lib/task-focus-request";
import type { LoyaltyBucket } from "../selectors/loyalty-board";
import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface CommandDeckBoardProps {
  /** Free-text search from `QuestBoard`'s toolbar. Defaults to "" so this renders standalone (e.g. in tests). */
  searchQuery?: string;
  /** Set by `QuestBoard` when the user clicks a result in its search dropdown, only while Command Deck is the active tab. See `TaskFocusRequest`'s own doc comment and `focusOnTask` below for how this board reacts to it. */
  focusRequest?: TaskFocusRequest | null;
}

/**
 * `statusBadge`'s locked-with-reason label (e.g. "Locked - 1 prerequisite
 * quest incomplete") is meant for a spacious badge context (`TaskBadges`'s
 * flex-wrap row); the task list here is a narrow sidebar row where that much
 * text crowds out the task name itself (a `shrink-0` badge next to a
 * `truncate` name otherwise squeezes the name down to a couple characters).
 * Shortens any locked reason to the plain "Locked" label; the badge's color
 * still carries the real status, and the full reason stays visible once a
 * task is selected, via `TaskBadges` in the detail panel.
 */
function shortStatusBadge(
  task: NormalizedTask,
  availability: QuestAvailability,
): ReturnType<typeof statusBadge> {
  const badge = statusBadge(task, availability);
  return badge.label.startsWith("Locked") ? { label: "Locked", variant: badge.variant } : badge;
}

interface TraderTaskDetailProps {
  task: NormalizedTask;
  tasksById: ReadonlyMap<string, NormalizedTask>;
  tasksData: readonly NormalizedTask[];
  availability: QuestAvailability | undefined;
  pinned: boolean;
  onStart: (taskId: string) => void;
  onDone: (taskId: string) => void;
  onFail: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  onTogglePin: (taskId: string) => void;
  /** Re-targets this board's own trader+task selection at a prerequisite/dependent quest clicked inside `QuestDetailSections`. Backed by `CommandDeckBoard`'s own `focusOnTask`, the same function a search-dropdown selection uses. */
  onSelectTask: (taskId: string) => void;
}

/**
 * The right-hand detail pane: a hero image + title + badges (`TaskBadges`,
 * shared with `QuestDetailDialog`), a normal Start/Complete/Fail/Undo/Pin
 * action-button row (matching `QuestDetailDialog`'s own bottom row instead
 * of the full-width flat-color bar an earlier version of this pane used -
 * that bar's "Locked"/"Complete"/"Failed" states were already fully
 * duplicated by the `TaskBadges` status chip sitting right above it in the
 * hero), and `QuestDetailSections` for everything else (prerequisites/
 * unlocks/trader-requirements/item-requirements/objectives/rewards/fail-
 * conditions/wiki guide). There's no separate "Full details" dialog trigger
 * here anymore: this pane renders the exact same `QuestDetailSections`
 * `QuestDetailDialog` does, so there's no leaner/richer split for a second
 * view to open into, and the two can never disagree about what a section
 * renders.
 */
function TraderTaskDetail({
  task,
  tasksById,
  tasksData,
  availability,
  pinned,
  onStart,
  onDone,
  onFail,
  onUndo,
  onTogglePin,
  onSelectTask,
}: TraderTaskDetailProps) {
  return (
    <div className="flex flex-col">
      {task.taskImageLink ? (
        <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-48">
          {/* `taskImageLink` is native 314x177 on tarkov.dev (no higher-res
              variant exists at any URL suffix - see `QuestDetailDialog`'s
              matching comment), well short of this card's full-bleed size,
              so stretching it flat across the whole box the way the sidebar
              detail pane used to visibly upscaled it into a blurry mess.
              Blurred on purpose instead: a blur needs no real detail to look
              right, so the low native resolution stops being visible at all,
              while still giving the card a photo-derived color wash instead
              of a flat surface. `scale-125` pushes the blur's own soft edge
              past the box's bounds so no unblurred rim shows at the edges. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset. */}
          <img
            src={task.taskImageLink}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="from-card via-card/85 pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t to-transparent"
          />
          <div className="relative flex h-full items-end gap-3 p-4">
            {/* The same photo again, this time shown crisp at close to its
                real 314x177 size (downscaled, never upscaled) instead of
                stretched, so the actual image detail stays visible
                somewhere on the card rather than being blurred away
                entirely. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset. */}
            <img
              src={task.taskImageLink}
              alt=""
              className="h-20 w-36 shrink-0 rounded-md object-cover shadow-lg ring-1 ring-white/10"
            />
            <div className="flex min-w-0 flex-col gap-2 pb-0.5">
              <h2 className="text-xl font-bold [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
                {task.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <TaskBadges task={task} availability={availability} overlaid />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-4">
          <h2 className="text-xl font-bold">{task.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <TaskBadges task={task} availability={availability} overlaid={false} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {availability?.status === "notstarted" && (
            <Button
              type="button"
              disabled={!availability.isAvailable}
              onClick={() => {
                onStart(task.id);
              }}
            >
              {availability.isAvailable ? "Start task" : "Locked"}
            </Button>
          )}
          {availability?.status === "inprog" && (
            <>
              <Button
                type="button"
                onClick={() => {
                  onDone(task.id);
                }}
              >
                Complete
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onFail(task.id);
                }}
              >
                Fail
              </Button>
            </>
          )}
          {(availability?.status === "done" || availability?.status === "failed") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onUndo(task.id);
              }}
            >
              Undo
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onTogglePin(task.id);
            }}
          >
            {pinned ? "Unpin" : "Pin"}
          </Button>
        </div>

        {availability?.status === "inprog" && !task.restartable && (
          <p className="text-muted-foreground text-xs">
            This task cannot be retried after failing.
          </p>
        )}

        <QuestDetailSections
          task={task}
          tasksById={tasksById}
          tasksData={tasksData}
          availability={availability}
          onSelectTask={onSelectTask}
        />
      </div>
    </div>
  );
}

/**
 * `QuestBoard`'s "Command Deck" tab: a trader-visit-screen board laid out
 * like the in-game trader "TASKS" tab (see the reference screenshot this was
 * built from): a horizontal trader avatar strip up top acting as a selector,
 * that trader's tasks on the left grouped by loyalty-tier section (same
 * `buildLoyaltyBoard` resolver every other board view reads, so all of them
 * agree on where a task sits), and the selected task's full detail on the
 * right (`TraderTaskDetail`). Restyled entirely in this site's own card/
 * badge/button vocabulary rather than copying BSG's actual UI chrome.
 *
 * `searchQuery`/`showLocked`/`showCompleted` filter the trader strip itself
 * (a trader with zero matching tasks drops out of the strip) as well as the
 * task list. The selected trader/task both fall back to the first available
 * option once the current selection no longer matches, computed inline each
 * render rather than via an effect, so switching filters can never leave the
 * board pointed at a trader/task no longer in view.
 *
 * A search-dropdown selection (`focusRequest`, only acted on while this
 * board is the active tab) selects that task's trader and the task itself
 * (`focusOnTask`), which brings it up in the detail pane for free, then
 * scrolls its sidebar row into view and rings/pulses it for
 * `TASK_FOCUS_HIGHLIGHT_MS` once that row actually exists in the DOM
 * (`pendingFocusTaskId`'s retry effect): selecting a different trader
 * re-renders the sidebar with that trader's own task list, so the row can't
 * be found in the same synchronous call that changed the selection.
 */
export function CommandDeckBoard({ searchQuery = "", focusRequest = null }: CommandDeckBoardProps) {
  const { tasks: tasksData, tasksById } = useActiveModeTasks();
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();
  const availability = useQuestAvailability();
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);

  const [showLocked, setShowLocked] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTraderName, setSelectedTraderName] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [pendingFocusTaskId, setPendingFocusTaskId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handledFocusNonceRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredTasks = useMemo(() => {
    const allTasks = tasksData ?? [];
    if (!availability) return [];
    return allTasks.filter((task) => {
      const taskAvailability = availability.get(task.id);
      if (!showLocked && taskAvailability?.isLocked) return false;
      if (!showCompleted && taskAvailability?.status === "done") return false;
      return taskMatchesQuery(task, searchQuery);
    });
  }, [tasksData, availability, showLocked, showCompleted, searchQuery]);

  const traderNames = useMemo(
    () => sortTraderNames([...new Set(filteredTasks.map((task) => task.trader.name))]),
    [filteredTasks],
  );
  const effectiveTraderName =
    (selectedTraderName && traderNames.includes(selectedTraderName) ? selectedTraderName : null) ??
    traderNames[0] ??
    null;

  // Sourced from full `tasksData` (not `filteredTasks`) so the avatar strip's
  // image/done-total never flickers as `showLocked`/`showCompleted`/search change.
  const traderImageByName = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const task of tasksData ?? []) {
      if (!map.has(task.trader.name)) map.set(task.trader.name, task.trader.imageLink);
    }
    return map;
  }, [tasksData]);
  const traderStatsByName = useMemo(() => {
    const stats = new Map<string, { done: number; total: number }>();
    if (!availability) return stats;
    for (const task of tasksData ?? []) {
      const entry = stats.get(task.trader.name) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (availability.get(task.id)?.status === "done") entry.done += 1;
      stats.set(task.trader.name, entry);
    }
    return stats;
  }, [tasksData, availability]);

  const traderTasks = useMemo(
    () =>
      effectiveTraderName
        ? filteredTasks.filter((task) => task.trader.name === effectiveTraderName)
        : [],
    [filteredTasks, effectiveTraderName],
  );
  const board = useMemo(() => buildLoyaltyBoard(traderTasks), [traderTasks]);
  const tasksByBucket = useMemo(() => {
    const byBucket = new Map<LoyaltyBucket, NormalizedTask[]>(
      LOYALTY_BUCKET_ORDER.map((bucket) => [bucket, []]),
    );
    for (const task of traderTasks) {
      const entry = board.get(task.id);
      if (!entry) continue;
      byBucket.get(entry.bucket)?.push(task);
    }
    return byBucket;
  }, [traderTasks, board]);

  const effectiveTaskId =
    (selectedTaskId && traderTasks.some((task) => task.id === selectedTaskId)
      ? selectedTaskId
      : null) ??
    traderTasks[0]?.id ??
    null;
  const selectedTask = effectiveTaskId ? tasksById.get(effectiveTaskId) : undefined;
  const selectedTaskAvailability = effectiveTaskId ? availability?.get(effectiveTaskId) : undefined;

  // "Bring this task into view" for a search-dropdown selection: selects its
  // trader and itself (bringing it up in the detail pane immediately, and a
  // no-op on `tasksById` if the task genuinely doesn't exist, which
  // shouldn't happen - the search dropdown that produced this request only
  // ever lists tasks from the same live task set), then defers the sidebar
  // scroll+highlight to the retry effect below, since selecting a different
  // trader only actually re-renders that trader's own task list on the next
  // render, not synchronously in this call.
  function focusOnTask(taskId: string): void {
    const task = tasksById.get(taskId);
    if (!task) return;
    setSelectedTraderName(task.trader.name);
    setSelectedTaskId(task.id);
    setPendingFocusTaskId(taskId);
  }

  // Retries a focus deferred by `focusOnTask` above once the newly selected
  // trader's task list has actually rendered that task's own sidebar row.
  useEffect(() => {
    if (pendingFocusTaskId === null) return;
    const row = sidebarRef.current?.querySelector<HTMLElement>(
      `[data-task-id="${pendingFocusTaskId}"]`,
    );
    if (!row) return;
    setPendingFocusTaskId(null);
    // `typeof` check, not optional chaining: the DOM lib types declare
    // `scrollIntoView` as always present, so `?.()` is flagged as an
    // unnecessary chain even though jsdom (the test environment) genuinely
    // doesn't implement it at runtime.
    if (typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedTaskId(pendingFocusTaskId);
    if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTaskId(null);
      highlightTimeoutRef.current = null;
    }, TASK_FOCUS_HIGHLIGHT_MS);
    // `tasksByBucket` (not `pendingFocusTaskId` alone) is the real trigger
    // here: it's what actually changes the rendered sidebar this effect
    // re-checks.
  }, [pendingFocusTaskId, tasksByBucket]);

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
    return <NoActiveProfileNotice reason="browse tasks trader by trader" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox
            checked={showCompleted}
            onChange={(event) => {
              setShowCompleted(event.target.checked);
            }}
          />
          Show completed
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox
            checked={showLocked}
            onChange={(event) => {
              setShowLocked(event.target.checked);
            }}
          />
          Show locked
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {traderNames.map((traderName) => {
          const stats = traderStatsByName.get(traderName) ?? { done: 0, total: 0 };
          const image = traderImageByName.get(traderName) ?? null;
          const selected = traderName === effectiveTraderName;
          return (
            <button
              key={traderName}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setSelectedTraderName(traderName);
                setSelectedTaskId(null);
              }}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors ${
                selected ? "border-primary bg-accent" : "hover:bg-muted border-transparent"
              }`}
            >
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                <img
                  src={image}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover outline-2 outline-offset-1"
                  style={{ outlineColor: getTraderOutlineColor(traderName) }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-muted h-14 w-14 rounded-full outline-2 outline-offset-1"
                  style={{ outlineColor: getTraderOutlineColor(traderName) }}
                />
              )}
              <span className="max-w-20 truncate text-xs font-medium">{traderName}</span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {stats.done}/{stats.total}
              </span>
            </button>
          );
        })}
      </div>

      {traderNames.length === 0 || !selectedTask ? (
        <p className="text-muted-foreground text-sm">No tasks match the current filters.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr] md:items-start">
          <div
            ref={sidebarRef}
            className="border-border bg-card flex max-h-[70vh] flex-col overflow-y-auto rounded-lg border"
          >
            {LOYALTY_BUCKET_ORDER.map((bucket) => {
              const bucketTasks = tasksByBucket.get(bucket) ?? [];
              if (bucketTasks.length === 0) return null;
              return (
                <div key={bucket}>
                  <div
                    className={`sticky top-0 z-10 flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wide uppercase ${
                      bucket === "essential"
                        ? "bg-card border-status-amber text-status-amber border-b-2"
                        : "bg-muted"
                    }`}
                  >
                    <span>{loyaltyBucketLabel(bucket)}</span>
                    <span className="font-mono font-normal normal-case">{bucketTasks.length}</span>
                  </div>
                  <ul>
                    {bucketTasks.map((task) => {
                      const taskAvailability = availability.get(task.id);
                      const badge = taskAvailability
                        ? shortStatusBadge(task, taskAvailability)
                        : null;
                      const selected = task.id === effectiveTaskId;
                      const highlighted = task.id === highlightedTaskId;
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            data-task-id={task.id}
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedTaskId(task.id);
                            }}
                            className={`flex w-full items-center justify-between gap-2 border-l-4 px-3 py-2 text-left text-sm transition-colors ${
                              highlighted
                                ? "bg-accent border-primary ring-primary animate-pulse ring-2 ring-inset"
                                : selected
                                  ? "bg-accent border-primary"
                                  : "hover:bg-muted/60 border-transparent"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate">{task.name}</span>
                            {badge && (
                              <Badge variant={badge.variant} className="shrink-0">
                                {badge.label}
                              </Badge>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="border-border bg-card overflow-hidden rounded-lg border">
            <TraderTaskDetail
              task={selectedTask}
              tasksById={tasksById}
              tasksData={tasksData ?? []}
              availability={selectedTaskAvailability}
              pinned={progress.pinnedTaskIds.includes(selectedTask.id)}
              onStart={startTask}
              onDone={doneTask}
              onFail={failTask}
              onUndo={undoTask}
              onTogglePin={togglePinnedTask}
              onSelectTask={focusOnTask}
            />
          </div>
        </div>
      )}
    </div>
  );
}
