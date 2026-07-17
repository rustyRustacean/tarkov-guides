"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";

import { CharacterStatsDialog } from "./CharacterStatsDialog";

export type QuestSortBy = "behind" | "impact" | "level" | "name" | "trader";

export interface QuestFilters {
  search: string;
  traderName: string | null;
  kappaOnly: boolean;
  hideDone: boolean;
  /** Locked (unmet-prerequisite) tasks are hidden unless this is set - see `matchesFilters` in `QuestList.tsx`. */
  showLocked: boolean;
  sortBy: QuestSortBy;
}

/** The list view's default filter state - no search/trader filter, locked tasks hidden, sorted by how many other quests are gated behind each one (most first). */
export function defaultQuestFilters(): QuestFilters {
  return {
    search: "",
    traderName: null,
    kappaOnly: false,
    hideDone: false,
    showLocked: false,
    sortBy: "behind",
  };
}

export interface QuestFilterBarProps {
  filters: QuestFilters;
  onFiltersChange: (filters: QuestFilters) => void;
  traderNames: readonly string[];
}

const inputClassName =
  "border-border bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

/**
 * Search/trader/kappa/hide-done/sort controls for the quest views, plus
 * the entry point into {@link CharacterStatsDialog} (moved here from a
 * temporary placement directly on `ProgressTrackerPage` now that this
 * component exists, per the implementation plan's step 10 note).
 */
export function QuestFilterBar({ filters, onFiltersChange, traderNames }: QuestFilterBarProps) {
  const [statsOpen, setStatsOpen] = useState(false);

  function update(patch: Partial<QuestFilters>): void {
    onFiltersChange({ ...filters, ...patch });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <input
        type="search"
        placeholder="Search quests…"
        value={filters.search}
        onChange={(event) => {
          update({ search: event.target.value });
        }}
        className={`${inputClassName} min-w-40 flex-1`}
        aria-label="Search quests"
      />

      <select
        value={filters.traderName ?? ""}
        onChange={(event) => {
          update({ traderName: event.target.value === "" ? null : event.target.value });
        }}
        className={inputClassName}
        aria-label="Filter by trader"
      >
        <option value="">All traders</option>
        {traderNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <select
        value={filters.sortBy}
        onChange={(event) => {
          update({ sortBy: event.target.value as QuestSortBy });
        }}
        className={inputClassName}
        aria-label="Sort quests by"
      >
        <option value="behind">Sort: Tasks behind</option>
        <option value="impact">Sort: Priority</option>
        <option value="level">Sort: Level</option>
        <option value="name">Sort: Name</option>
        <option value="trader">Sort: Trader</option>
      </select>

      <label className="flex items-center gap-1.5">
        <Checkbox
          checked={filters.kappaOnly}
          onChange={(event) => {
            update({ kappaOnly: event.target.checked });
          }}
        />
        Kappa only
      </label>

      <label className="flex items-center gap-1.5">
        <Checkbox
          checked={filters.hideDone}
          onChange={(event) => {
            update({ hideDone: event.target.checked });
          }}
        />
        Hide done
      </label>

      <label className="flex items-center gap-1.5">
        <Checkbox
          checked={filters.showLocked}
          onChange={(event) => {
            update({ showLocked: event.target.checked });
          }}
        />
        Show locked
      </label>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setStatsOpen(true);
        }}
      >
        Character Stats
      </Button>

      <CharacterStatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}
