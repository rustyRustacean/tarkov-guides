"use client";

import { useState } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { getMapTrackedItems } from "../lib/map-sidebar-items";
import { useMapsStore } from "../store";

import { MapSidebarItems } from "./MapSidebarItems";
import { MapSidebarTasks } from "./MapSidebarTasks";
import { MapValuablesPanel } from "./MapValuablesPanel";

const inputClassName =
  "border-border bg-background focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

interface Props {
  normalizedName: string;
}

/**
 * The map screen's sidebar - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapSidebar.js`. Composes the Items pane and Tasks pane
 * behind a `Tabs` switch (Items / Tasks / Flea Market). The shared search
 * box filters whichever pane is active: Items filters the map's needed items
 * by name, Tasks searches tasks (matching name/trader/map/item, so an item
 * name surfaces the tasks that need it), and Flea Market filters that pane's
 * items. No pane auto-switching - the query targets the visible pane.
 */
export function MapSidebar({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const tasks = data?.tasks ?? [];
  const items = data?.items ?? [];
  const maps = data?.maps ?? [];

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useProgressTrackerStore((state) =>
    activeProfileId !== null ? state.progressByProfile[activeProfileId] : undefined,
  );

  const sidebarPane = useMapsStore((state) => state.sidebarPane);
  const setSidebarPane = useMapsStore((state) => state.setSidebarPane);
  const thresholdRub = useMapsStore((state) => state.topDollarThresholdRub);
  const setTopDollarThreshold = useMapsStore((state) => state.setTopDollarThreshold);

  const [searchQuery, setSearchQuery] = useState("");

  const mapDisplayName =
    maps.find((m) => m.normalizedName === normalizedName)?.name ?? normalizedName;
  const rows = progress ? getMapTrackedItems(tasks, items, progress, normalizedName) : [];
  const itemRows = rows.filter((row) => row.source !== "custom");
  const customItemRows = rows.filter((row) => row.source === "custom");

  return (
    // The search + tabs sit on a solid header panel (opaque, so it reads
    // cleanly over the map); only the entry lists below it stay transparent
    // and float over the map. Scrollbars are hidden (`scrollbar-none`) while
    // the panes still scroll.
    <Tabs
      value={sidebarPane}
      onValueChange={(pane) => {
        setSidebarPane(pane === "tasks" || pane === "flea" ? pane : "items");
      }}
      className="flex h-full flex-col gap-2"
    >
      <div className="border-border bg-card/95 flex flex-col gap-2 rounded-md border p-2 shadow-sm backdrop-blur-sm">
        <input
          type="search"
          placeholder="name, trader, map, item"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
          className={inputClassName}
          aria-label="Search tasks"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="items">Task Items</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="flea">Flea Market</TabsTrigger>
          </TabsList>
          {sidebarPane === "flea" && (
            <label
              className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs"
              title="Minimum 24h average flea price to list, in thousands of roubles"
            >
              min
              <input
                type="number"
                min={1}
                step={5}
                value={Math.round(thresholdRub / 1000)}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (Number.isFinite(parsed) && parsed > 0) setTopDollarThreshold(parsed * 1000);
                }}
                className="border-border bg-background focus-visible:ring-ring w-20 rounded border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
                aria-label="Minimum 24h average price in thousands of roubles"
              />
              k₽
            </label>
          )}
        </div>
      </div>
      <TabsContent value="items" className="min-h-0 flex-1 scrollbar-none overflow-y-auto">
        <MapSidebarItems
          items={itemRows}
          customItems={customItemRows}
          mapDisplayName={mapDisplayName}
          searchQuery={searchQuery}
        />
      </TabsContent>
      <TabsContent value="tasks" className="min-h-0 flex-1 scrollbar-none overflow-y-auto">
        <MapSidebarTasks normalizedName={normalizedName} searchQuery={searchQuery} />
      </TabsContent>
      <TabsContent value="flea" className="min-h-0 flex-1 scrollbar-none overflow-y-auto">
        <MapValuablesPanel normalizedName={normalizedName} searchQuery={searchQuery} />
      </TabsContent>
    </Tabs>
  );
}
