"use client";

import { useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { useKappaTracker } from "../hooks/use-kappa-tracker";
import { getHideoutKappaItems, getKappaItems, sortKappaItems } from "../lib/kappa";
import { useProgressTrackerStore } from "../store";

import { KappaItemCard } from "./KappaItemCard";
import { KappaItemTable } from "./KappaItemTable";

import type { KappaItem } from "../lib/kappa";

type ViewMode = "cards" | "table";

/**
 * Self-contained (reads live game data + the active profile itself, same
 * pattern as `CharacterStatsDialog`/`RaidCommitBar`) Kappa/hideout
 * stockpiling checklist. Two sub-tabs - Hideout items (every item needed
 * across every not-yet-built hideout level) and Quest items (the Collector
 * task's item requirements) - share one Cards/Table view toggle and one
 * `kappaGot` keyspace (see `types.ts`'s doc comment): checking an item off
 * in either tab marks it everywhere.
 */
export function KappaTracker() {
  const { data } = useTarkovGameData();
  const tasksData = data?.tasks;
  const hideoutStationsData = data?.hideoutStations;
  const tasks = tasksData ?? [];
  const hideoutStations = hideoutStationsData ?? [];

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const { toggle, justGotIds } = useKappaTracker();

  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  if (!progress) {
    return (
      <p className="text-muted-foreground text-sm">
        No active profile - create one to start tracking Kappa items.
      </p>
    );
  }

  const questItems = sortKappaItems(getKappaItems(tasks, progress.kappaGot), justGotIds);
  const hideoutItems = sortKappaItems(
    getHideoutKappaItems(hideoutStations, progress.hideoutBuilt, progress.kappaGot),
    justGotIds,
  );

  function renderItems(items: readonly KappaItem[]) {
    if (items.length === 0) {
      return <p className="text-muted-foreground text-sm">Nothing to show here.</p>;
    }
    if (viewMode === "table") {
      return <KappaItemTable items={items} justGotIds={justGotIds} onToggle={toggle} />;
    }
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <KappaItemCard
              item={item}
              isTransitioning={justGotIds.has(item.id)}
              onToggle={toggle}
            />
          </li>
        ))}
      </ul>
    );
  }

  function gotCount(items: readonly KappaItem[]): number {
    return items.filter((item) => item.got).length;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          variant={viewMode === "cards" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setViewMode("cards");
          }}
        >
          Cards
        </Button>
        <Button
          type="button"
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setViewMode("table");
          }}
        >
          Table
        </Button>
      </div>

      <Tabs defaultValue="hideout">
        <TabsList>
          <TabsTrigger value="hideout">
            Hideout items ({gotCount(hideoutItems)}/{hideoutItems.length})
          </TabsTrigger>
          <TabsTrigger value="quest">
            Quest items ({gotCount(questItems)}/{questItems.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hideout">{renderItems(hideoutItems)}</TabsContent>
        <TabsContent value="quest">{renderItems(questItems)}</TabsContent>
      </Tabs>
    </div>
  );
}
