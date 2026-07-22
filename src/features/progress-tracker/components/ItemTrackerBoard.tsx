"use client";

import { useMemo, useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";

import { useItemTracking } from "../hooks/use-item-tracking";
import { getTrackedItems } from "../selectors/item-progress";
import { useProgressTrackerStore } from "../store";

import { CustomItemDialog } from "./CustomItemDialog";
import { ItemRow } from "./ItemRow";
import { RaidCommitBar } from "./RaidCommitBar";

import type { TrackedItem } from "../selectors/item-progress";

function sortFirFirst(items: readonly TrackedItem[]): TrackedItem[] {
  return [...items].sort((a, b) => Number(b.foundInRaid) - Number(a.foundInRaid));
}

/**
 * The Items tab - merges task/custom/pinned items via `getTrackedItems`
 * into four sections: Pinned, Needed, Collected (hidden by default), and
 * Custom Items (always shown, regardless of collected state - matches
 * legacy's "custom items always under a divider" behavior).
 */
export function ItemTrackerBoard() {
  const { data } = useTarkovGameData();
  // Read `data?.foo` directly as each memo's dependency below (not
  // `data?.foo ?? []`) - a `?? []` fallback is a fresh array reference every
  // render whenever `data` is undefined, which would defeat memoization;
  // the fallback is applied inside each memo's body instead. Same fix as
  // `QuestList`'s `tasksData`/`use-task-actions.ts`.
  const tasksData = data?.tasks;
  const itemsData = data?.items;
  const maps = data?.maps ?? [];

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const togglePinnedItem = useProgressTrackerStore((state) => state.togglePinnedItem);
  const { adjustPending, editStash, fillMoney, removeCustomItem } = useItemTracking();

  const [showCollected, setShowCollected] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // `itemsById` maps over the ENTIRE live item catalog (thousands of
  // entries) and `getTrackedItems` merges task/custom/pinned/orphaned-pending
  // sources - both real work, previously redone on every render including
  // every pending +/-1 click. Memoized here (before the early return below,
  // per the Rules of Hooks - same pattern `QuestTreeView`'s `availability`
  // memo already uses ahead of its own early return).
  const itemsById = useMemo(
    () => new Map((itemsData ?? []).map((item) => [item.id, item])),
    [itemsData],
  );
  const trackedItems = useMemo(
    () => (progress ? getTrackedItems(tasksData ?? [], itemsData ?? [], progress) : []),
    [tasksData, itemsData, progress],
  );
  const pinned = useMemo(
    () => sortFirFirst(trackedItems.filter((item) => item.pinned)),
    [trackedItems],
  );
  const needed = useMemo(
    () =>
      sortFirFirst(
        trackedItems.filter((item) => !item.pinned && !item.isCustom && item.remaining > 0),
      ),
    [trackedItems],
  );
  const collected = useMemo(
    () =>
      sortFirFirst(
        trackedItems.filter((item) => !item.pinned && !item.isCustom && item.remaining === 0),
      ),
    [trackedItems],
  );
  const custom = useMemo(
    () => sortFirFirst(trackedItems.filter((item) => !item.pinned && item.isCustom)),
    [trackedItems],
  );

  if (!progress) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to start tracking items.
      </p>
    );
  }

  function renderSection(title: string, rows: readonly TrackedItem[]) {
    if (rows.length === 0) return null;
    return (
      <Card key={title}>
        <CardHeader>
          <CardTitle>
            {title} ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {rows.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                catalogItem={itemsById.get(item.id)}
                maps={maps}
                onAdjustPending={adjustPending}
                onEditStash={editStash}
                onFillMoney={fillMoney}
                onTogglePin={togglePinnedItem}
                onRemoveCustom={removeCustomItem}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <RaidCommitBar />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setAddDialogOpen(true);
          }}
        >
          Add Custom Item
        </Button>
        {collected.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowCollected((current) => !current);
            }}
          >
            {showCollected ? "Hide" : "Show"} Collected ({collected.length})
          </Button>
        )}
      </div>

      {trackedItems.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No items tracked yet - start a quest or add a custom item.
        </p>
      ) : (
        <>
          {renderSection("Pinned", pinned)}
          {renderSection("Needed", needed)}
          {showCollected && renderSection("Collected", collected)}
          {renderSection("Custom Items", custom)}
        </>
      )}

      <CustomItemDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
