"use client";

import { useId, useMemo, useRef, useState } from "react";

import { taskMatchesQuery } from "@/shared/lib/task-search";
import { Button } from "@/shared/ui/button/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";

import { MapRecommendationDialog } from "./MapRecommendationDialog";
import { QuestAnalyticsPanel } from "./QuestAnalyticsPanel";
import { QuestList } from "./QuestList";
import { QuestTreeView } from "./QuestTreeView";
import { TraderTaskBoard } from "./TraderTaskBoard";

import type { TreeFocusRequest } from "./QuestTreeView";
import type { KeyboardEvent } from "react";

const searchInputClassName =
  "border-border bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

/** Matching task rows shown in the search dropdown, enough to be useful without turning into a second scrollable list. */
const MAX_SEARCH_RESULTS = 8;

/**
 * Quests tab container: view-mode switcher (List / Tree / Trader /
 * Analytics). Defaults to Tree: the trader-lane graph gives a better
 * at-a-glance sense of what's actually reachable than the flat list does,
 * so it leads. A "What map do I go to?" trigger sits to the right of the
 * tab row (mirrors `ProgressTrackerPage`'s title/`ProfileSwitcher`
 * flex-row pattern) opening `MapRecommendationDialog`, useful regardless
 * of which view mode is currently active, so it lives here rather than
 * inside any one view. The former standalone "Recommendations" tab
 * (`QuestRecommendations`, a flat priority-ranked quest list) was folded
 * into that same dialog, grouped by map instead of one flat list: "where
 * do I go" and "what do I do there" are really one decision.
 *
 * A single free-text task search box sits between the view tabs and that
 * button, shared by every view mode instead of each maintaining its own
 * (List used to have the only one, inside `QuestFilterBar`). The raw text
 * is passed straight through as List/Trader's `searchQuery` prop; they
 * filter their rows the same way List's own search always did. Tree never
 * hides nodes (see its own doc comment), so instead of live-filtering,
 * this renders a below-the-input results dropdown (like a typical site
 * search box) of matching tasks; clicking one force-switches to the Tree
 * tab (`activeTab`, now controlled instead of `defaultValue`, so a click
 * from List/Trader can jump there too) and hands it a `focusRequest`, a
 * fresh `{ taskId, nonce }` each time (the nonce lets the same task be
 * re-selected twice in a row and still re-trigger the jump/highlight,
 * since object identity alone wouldn't be enough once `QuestTreeView`
 * ends up comparing primitive fields).
 */
export function QuestBoard() {
  const { tasks: allTasks, isAccurateForMode } = useActiveModeTasks();
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [dropdownDismissed, setDropdownDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [treeFocusRequest, setTreeFocusRequest] = useState<TreeFocusRequest | null>(null);
  const focusNonceRef = useRef(0);
  const searchListboxId = useId();

  // Filter predicate shared with `QuestList`/`TraderTaskBoard` via
  // `taskMatchesQuery`: matches name/trader/map/item/"kappa", not just
  // name. The name-starts-with-first sort stays local to this dropdown;
  // that ordering preference isn't part of what the three views'
  // predicates disagreed on.
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
    setTreeFocusRequest({ taskId, nonce: focusNonceRef.current });
    setActiveTab("tree");
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
      {!isAccurateForMode && (
        <p className="border-border bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-sm">
          Season task data isn&apos;t available from tarkov.dev yet - showing the standard PvP task
          list below. Your Season progress is still tracked separately.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="tree">Tree</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="trader">Trader</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
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
            setMapDialogOpen(true);
          }}
        >
          What map do I go to?
        </Button>
      </div>

      <MapRecommendationDialog open={mapDialogOpen} onOpenChange={setMapDialogOpen} />

      <TabsContent value="tree">
        <QuestTreeView focusRequest={treeFocusRequest} />
      </TabsContent>
      <TabsContent value="list">
        <QuestList searchQuery={searchQuery} />
      </TabsContent>
      <TabsContent value="trader">
        <TraderTaskBoard searchQuery={searchQuery} />
      </TabsContent>
      <TabsContent value="analytics">
        <QuestAnalyticsPanel />
      </TabsContent>
    </Tabs>
  );
}
