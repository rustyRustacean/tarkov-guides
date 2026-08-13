"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";

import { CharacterStatsDialog } from "./CharacterStatsDialog";

export type QuestSortBy = "behind" | "impact" | "level" | "name" | "trader";

export interface QuestFilters {
  traderName: string | null;
  kappaOnly: boolean;
  hideDone: boolean;
  /** Locked (unmet-prerequisite) tasks are hidden unless this is set. See `matchesFilters` in `QuestList.tsx`. */
  showLocked: boolean;
  sortBy: QuestSortBy;
}

/** The list view's default filter state: no trader filter, locked tasks hidden, sorted by how many other quests are gated behind each one (most first). Free-text search isn't part of this state; it's `QuestBoard`'s shared toolbar search box, passed down as its own `searchQuery` prop instead (see `QuestList`'s doc comment). */
export function defaultQuestFilters(): QuestFilters {
  return {
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
 * Trader/kappa/hide-done/sort controls for the quest views, plus the entry
 * point into {@link CharacterStatsDialog} (moved here from a temporary
 * placement directly on `ProgressTrackerPage` now that this component
 * exists). Free-text search used to live here too, but moved up to
 * `QuestBoard`'s shared toolbar: one search box now covers all view modes
 * rather than each duplicating its own (List was the only one that ever
 * had one).
 */
export function QuestFilterBar({ filters, onFiltersChange, traderNames }: QuestFilterBarProps) {
  const [statsOpen, setStatsOpen] = useState(false);

  function update(patch: Partial<QuestFilters>): void {
    onFiltersChange({ ...filters, ...patch });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
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
