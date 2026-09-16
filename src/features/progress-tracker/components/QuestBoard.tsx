"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { taskMatchesQuery } from "@/shared/lib/task-search";
import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { Button } from "@/shared/ui/button/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";

import { CommandDeckBoard } from "./CommandDeckBoard";
import { KappaChecklistDialog } from "./KappaChecklistDialog";
import { MapRecommendationDialog } from "./MapRecommendationDialog";
import { QuestAnalyticsPanel } from "./QuestAnalyticsPanel";
import { QuestSwimlaneMatrix } from "./QuestSwimlaneMatrix";
import { QuestTreeView } from "./QuestTreeView";

import type { QuestTreeViewport } from "./QuestTreeView";
import type { TaskFocusRequest } from "../lib/task-focus-request";
import type { KeyboardEvent } from "react";

const searchInputClassName =
  "border-border bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

/**
 * Same active-tab accent treatment `MapPicker` established for the Maps
 * feature's map-switcher row: a soft tint of the theme's own accent color
 * (amber on Inventory Grid) plus a hairline ring, instead of the shared
 * `Tabs` default's plain gray "selected" fill. Applied to every
 * `TabsTrigger` below so the view-mode row matches.
 *
 * The tint/ring itself no longer lives here: it's painted once by the
 * sliding `<span>` indicator rendered inside `TabsList` (see
 * `indicatorRect` below), which animates between trigger positions on
 * click instead of the fill just popping to wherever `data-state=active`
 * landed. This class only clears the shared `Tabs` default's own opaque
 * `bg-background`/`shadow-sm` (so the active trigger stays transparent and
 * lets the indicator show through underneath it), sets the active label's
 * text color, and keeps every trigger stacked above the indicator
 * (`relative z-10`, the indicator itself is `z-0`).
 */
const accentTabTriggerClassName =
  "relative z-10 data-[state=active]:bg-transparent [&:not([data-state=active])]:hover:bg-accent data-[state=active]:text-primary data-[state=active]:shadow-none";

/** Matching task rows shown in the search dropdown, enough to be useful without turning into a second scrollable list. */
const MAX_SEARCH_RESULTS = 8;

/**
 * Quests tab container: view-mode switcher (Command Deck / Matrix / Tree /
 * Analytics). Defaults to Command Deck per direct user request (2026-09-15):
 * its per-trader "visit screen" layout, now with the full prerequisites/
 * unlocks/rewards/wiki-guide breakdown inlined via `QuestDetailSections`
 * rather than behind a separate dialog, reads as the most complete single
 * view for "what should I be doing right now" on first load. Matrix reads
 * from the same `resolveLoyaltyBoardEntry`/`buildLoyaltyBoard` resolver as
 * Tree's row bands and Command Deck's own sidebar, so all three agree on
 * where a task sits. A "Kappa checklist" trigger
 * opens `KappaChecklistDialog` (the real, API-verified Kappa requirement:
 * deliberately separate from the curated "Essential" row Matrix shows, a
 * broader, still-being-curated BSG UI category, see
 * `data/loyalty-board-overrides.ts`), and a "What map do I go to?" trigger
 * opens `MapRecommendationDialog`; both sit to the right of the tab row
 * (mirrors `ProgressTrackerPage`'s title/`ProfileSwitcher` flex-row
 * pattern), useful regardless of which view mode is currently active, so
 * they live here rather than inside any one view. The former standalone
 * "Recommendations" tab (`QuestRecommendations`, a flat priority-ranked
 * quest list) was folded into the map dialog, grouped by map instead of one
 * flat list: "where do I go" and "what do I do there" are really one
 * decision.
 *
 * Several other view modes (Sections, List, Trader, Kanban Flow, Trader
 * Codex, and an earlier "Command Deck" board this tab's own name now
 * belongs to instead) were removed 2026-09-06 down to this leaner four-tab
 * set per direct user request; see `HANDOFF.md`'s dated entry for what was
 * deleted and why before reintroducing anything with a similar shape.
 *
 * A single free-text task search box sits between the view tabs and those
 * buttons, shared by every view mode. The raw text is passed straight
 * through as every other tab's `searchQuery` prop for live-filtering
 * (except Tree, which never hides nodes, see its own doc comment). It also
 * renders a below-the-input results dropdown (like a typical site search
 * box) of matching tasks; clicking one focuses that task **in whatever view
 * is currently active** rather than force-switching tabs (`focusRequest`, a
 * fresh `{ taskId, nonce }` each time via `TaskFocusRequest`, handed to
 * whichever of Matrix/Tree/Command Deck is actually mounted - the nonce lets
 * the same task be re-selected twice in a row and still re-trigger the
 * jump/highlight, since object identity alone wouldn't be enough once a
 * consumer ends up comparing primitive fields). Each of those three views
 * implements its own idea of "focus" (Tree pans/zooms and rings the node;
 * Matrix scrolls to and rings the chip, expanding its chain first if
 * needed; Command Deck selects the task's trader and the task itself, then
 * rings its sidebar row) - see each one's own doc comment. Analytics has no
 * per-task view to focus into, so a click while it's active falls back to
 * switching to Tree instead of doing nothing.
 */
export function QuestBoard() {
  const { tasks: allTasks } = useActiveModeTasks();
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [kappaDialogOpen, setKappaDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("deck");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [dropdownDismissed, setDropdownDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [focusRequest, setFocusRequest] = useState<TaskFocusRequest | null>(null);
  // Tree's last-reported pan/zoom, held here (not inside `QuestTreeView`
  // itself) because Radix `Tabs.Content` unmounts an inactive tab's panel
  // by default: switching to Matrix and back to Tree remounts it from
  // scratch, which would otherwise lose its camera position. Handed back
  // in as `initialViewport` on the next mount; `null` (its starting value,
  // and its value again after any real page refresh, since this is plain
  // `useState` rather than persisted storage) tells `QuestTreeView` "never
  // opened before in this page load", which is what triggers its
  // auto-jump-to-Mechanic default instead of restoring a prior position.
  // See `QuestTreeView`'s own doc comment on `initialViewport`.
  const [treeViewport, setTreeViewport] = useState<QuestTreeViewport | null>(null);
  const focusNonceRef = useRef(0);
  const searchListboxId = useId();
  const viewTabsListId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Pixel box (relative to the view-tabs `TabsList`, its offset parent
  // once given `position: relative` below) of whichever trigger currently
  // carries `data-state="active"`, read via `offsetLeft`/`offsetWidth`
  // rather than a per-trigger ref map: simpler than plumbing a ref for
  // each of the four fixed tabs, and `id` + `document.getElementById`
  // sidesteps needing the shared `TabsList` wrapper to forward a ref at
  // all. `null` until the first post-mount measurement lands, which the
  // indicator's own render below treats as "not positioned yet" rather
  // than flashing at a wrong default spot.
  const [indicatorRect, setIndicatorRect] = useState<{ left: number; width: number } | null>(null);

  // Slides the active-tab indicator to the newly active trigger on every
  // `activeTab` change (plus an initial measurement on mount, and a
  // re-measurement on resize, since the row can reflow at narrow widths).
  // The CSS `transition` living on the indicator's own inline style is
  // what actually animates the move; this effect just supplies the new
  // target `left`/`width` for it to animate toward.
  useEffect(() => {
    function measure(): void {
      const list = document.getElementById(viewTabsListId);
      const active = list?.querySelector<HTMLElement>('[data-state="active"]');
      if (!active) return;
      setIndicatorRect({ left: active.offsetLeft, width: active.offsetWidth });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [activeTab, viewTabsListId]);

  // Filter predicate shared with every other tab via `taskMatchesQuery`:
  // matches name/trader/map/item/"kappa", not just name. The
  // name-starts-with-first sort stays local to this dropdown.
  const searchMatches = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length === 0) return [];
    const lowerQuery = trimmedQuery.toLowerCase();
    return (allTasks ?? [])
      .filter((task) => taskMatchesQuery(task, searchQuery))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
        return aStarts !== bStarts ? aStarts - bStarts : a.name.localeCompare(b.name);
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }, [allTasks, searchQuery]);

  const dropdownOpen = isSearchFocused && !dropdownDismissed && searchMatches.length > 0;

  function selectSearchResult(taskId: string): void {
    focusNonceRef.current += 1;
    setFocusRequest({ taskId, nonce: focusNonceRef.current });
    // Analytics has no per-task view to focus into, so fall back to Tree
    // (the "precision jump to one task" surface) rather than leaving the
    // click with nothing to show for it. Every other tab focuses the task
    // in place instead of switching away from whatever the user was on.
    if (activeTab === "analytics") setActiveTab("tree");
    setSearchQuery("");
    setDropdownDismissed(false);
    setHighlightedIndex(0);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!dropdownOpen) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((current) => Math.min(searchMatches.length - 1, current + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(0, current - 1));
        break;
      case "Enter": {
        event.preventDefault();
        const target = searchMatches[highlightedIndex] ?? searchMatches[0];
        if (target) selectSearchResult(target.id);
        break;
      }
      case "Escape":
        event.preventDefault();
        setDropdownDismissed(true);
        break;
      default:
        break;
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList id={viewTabsListId} className="relative">
          {indicatorRect && (
            <span
              aria-hidden="true"
              className="bg-primary/15 ring-primary/30 pointer-events-none absolute inset-y-1 left-0 z-0 rounded-md ring-1 ring-inset"
              style={{
                width: indicatorRect.width,
                transform: `translateX(${String(indicatorRect.left)}px)`,
                transition: prefersReducedMotion
                  ? "none"
                  : "transform 200ms ease-out, width 200ms ease-out",
              }}
            />
          )}
          <TabsTrigger value="deck" className={accentTabTriggerClassName}>
            Command Deck
          </TabsTrigger>
          <TabsTrigger value="matrix" className={accentTabTriggerClassName}>
            Matrix
          </TabsTrigger>
          <TabsTrigger value="tree" className={accentTabTriggerClassName}>
            Tree
          </TabsTrigger>
          <TabsTrigger value="analytics" className={accentTabTriggerClassName}>
            Analytics
          </TabsTrigger>
        </TabsList>

        <div
          className="relative min-w-40 flex-1"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsSearchFocused(false);
            }
          }}
        >
          <input
            type="search"
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setDropdownDismissed(false);
              setHighlightedIndex(0);
            }}
            onFocus={() => {
              setIsSearchFocused(true);
            }}
            onKeyDown={handleSearchKeyDown}
            className={searchInputClassName}
            aria-label="Search tasks"
            aria-expanded={dropdownOpen}
            aria-autocomplete="list"
            aria-controls={searchListboxId}
            role="combobox"
          />

          {dropdownOpen && (
            <ul
              id={searchListboxId}
              role="listbox"
              className="border-border bg-popover text-popover-foreground absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border p-1 shadow-lg"
            >
              {searchMatches.map((task, index) => (
                <li key={task.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlightedIndex}
                    // Prevents the input's blur (which would close this
                    // dropdown before the click even registers): a classic
                    // mousedown-before-blur race for any blur-to-close combobox.
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      selectSearchResult(task.id);
                    }}
                    className={`hover:bg-accent flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                      index === highlightedIndex ? "bg-accent" : ""
                    }`}
                  >
                    <span className="truncate">{task.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {task.trader.name} · Lv {task.minPlayerLevel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setKappaDialogOpen(true);
          }}
        >
          Kappa checklist
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMapDialogOpen(true);
          }}
        >
          What map do I go to?
        </Button>
      </div>

      <MapRecommendationDialog open={mapDialogOpen} onOpenChange={setMapDialogOpen} />
      <KappaChecklistDialog open={kappaDialogOpen} onOpenChange={setKappaDialogOpen} />

      <TabsContent value="deck">
        <CommandDeckBoard searchQuery={searchQuery} focusRequest={focusRequest} />
      </TabsContent>
      <TabsContent value="matrix">
        <QuestSwimlaneMatrix searchQuery={searchQuery} focusRequest={focusRequest} />
      </TabsContent>
      <TabsContent value="tree">
        <QuestTreeView
          focusRequest={focusRequest}
          initialViewport={treeViewport}
          onViewportChange={setTreeViewport}
        />
      </TabsContent>
      <TabsContent value="analytics">
        <QuestAnalyticsPanel />
      </TabsContent>
    </Tabs>
  );
}
