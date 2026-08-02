"use client";

import { useMemo } from "react";

import { BEGINNER_ITEMS } from "@/shared/data/beginner-items";
import { resolveGameItems } from "@/shared/lib/item-resolution/resolve-game-item";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { openItemDetail } from "@/shared/ui/item-detail/item-detail-store";

import { useProgressTrackerStore } from "../store";

import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";

/**
 * "What to hoard in your first two weeks" reference guide, ported from
 * `old/TarkovTrackerWB-main/src/components/kappa/kappa.js`'s
 * `renderBeginner()` - the curated `BEGINNER_ITEMS` categories
 * (`src/shared/data/beginner-items.ts`), resolved against the live item
 * catalog via `resolveGameItems`. Read-only reference content, with one
 * interactive affordance beyond legacy (which only opened a read-only item
 * detail modal, not built in this phase):
 * pinning an item straight into the Items tab's Pinned section, reusing the
 * existing `togglePinnedItem` store action (a no-op without an active
 * profile, same as everywhere else it's called).
 */
export function BeginnerItemsGuide() {
  const { data } = useTarkovGameData();
  const itemsData = data?.items;
  const items = useMemo(() => itemsData ?? [], [itemsData]);

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const togglePinnedItem = useProgressTrackerStore((state) => state.togglePinnedItem);

  const byShortName = useMemo(() => {
    const map: Record<string, NormalizedItem> = {};
    for (const item of items) {
      if (item.shortName) map[item.shortName.toLowerCase()] = item;
    }
    return map;
  }, [items]);

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Item data still loading…</p>;
  }

  const categories = BEGINNER_ITEMS.map((category) => ({
    category,
    resolved: resolveGameItems(category.items, items, byShortName),
  })).filter(({ resolved }) => resolved.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {categories.map(({ category, resolved }) => (
        <Card key={category.category}>
          <CardHeader>
            <CardTitle>{category.category}</CardTitle>
            <CardDescription>{category.why}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {resolved.map((item) => {
                const pinned = progress?.pinnedItemIds.includes(item.id) ?? false;
                return (
                  <li
                    key={item.id}
                    className="border-border bg-card flex items-center gap-3 rounded-md border p-2 text-sm"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      title="View item details"
                      onClick={() => {
                        openItemDetail(item.id);
                      }}
                    >
                      {item.iconLink && (
                        // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icons, not a local/optimizable asset.
                        <img
                          src={item.iconLink}
                          alt=""
                          className="h-8 w-8 shrink-0 object-contain"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {item.shortName}
                          {item.avg24hPrice ? ` · ${item.avg24hPrice.toLocaleString()}₽` : ""}
                        </div>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant={pinned ? "default" : "outline"}
                      aria-pressed={pinned}
                      onClick={() => {
                        togglePinnedItem(item.id);
                      }}
                    >
                      {pinned ? "Pinned" : "Pin"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
