"use client";

import { useState } from "react";

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
  const tasksData = data?.tasks;
  const itemsData = data?.items;
  const mapsData = data?.maps;
  const tasks = tasksData ?? [];
  const items = itemsData ?? [];
  const maps = mapsData ?? [];

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const togglePinnedItem = useProgressTrackerStore((state) => state.togglePinnedItem);
  const { adjustPending, editStash, fillMoney, removeCustomItem } = useItemTracking();

  const [showCollected, setShowCollected] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  if (!progress) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to start tracking items.
      </p>
    );
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const trackedItems = getTrackedItems(tasks, items, progress);

  const pinned = sortFirFirst(trackedItems.filter((item) => item.pinned));
  const needed = sortFirFirst(
    trackedItems.filter((item) => !item.pinned && !item.isCustom && item.remaining > 0),
  );
  const collected = sortFirFirst(
    trackedItems.filter((item) => !item.pinned && !item.isCustom && item.remaining === 0),
  );
  const custom = sortFirFirst(trackedItems.filter((item) => !item.pinned && item.isCustom));

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
