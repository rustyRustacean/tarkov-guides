"use client";

import { useState } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { getMapTrackedItems } from "../lib/map-sidebar-items";
import { useMapsStore } from "../store";

import { MapSidebarItems } from "./MapSidebarItems";
import { MapSidebarTasks } from "./MapSidebarTasks";

const inputClassName =
  "border-border bg-background focus-visible:ring-ring w-full rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

interface Props {
  normalizedName: string;
}

/**
 * The map screen's sidebar - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapSidebar.js`. Composes the Items pane and Tasks pane
 * behind a `Tabs` switch (this project's established Items/Tasks-pane
 * pattern, replacing legacy's simultaneous dual-visible "focused pane
 * full-size, other condensed" CSS trick - see the Phase 5 step 9 plan) and
 * the task-search box, which auto-switches to the Tasks pane on a non-empty
 * query (matches legacy's `onMapTaskSearch`). Not yet wired into a route -
 * `/maps` doesn't exist yet (step 13).
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

  const [searchQuery, setSearchQuery] = useState("");

  const mapDisplayName =
    maps.find((m) => m.normalizedName === normalizedName)?.name ?? normalizedName;
  const rows = progress ? getMapTrackedItems(tasks, items, progress, normalizedName) : [];
  const itemRows = rows.filter((row) => row.source !== "custom");
  const customItemRows = rows.filter((row) => row.source === "custom");

  return (
    <div className="flex h-full flex-col">
      <input
        type="search"
        placeholder="name, trader, map, item"
        value={searchQuery}
        onChange={(event) => {
          const value = event.target.value;
          setSearchQuery(value);
          if (value.trim().length > 0) setSidebarPane("tasks");
        }}
        className={inputClassName}
        aria-label="Search tasks"
      />

      <Tabs
        value={sidebarPane}
        onValueChange={(pane) => {
          setSidebarPane(pane === "tasks" ? "tasks" : "items");
        }}
        className="mt-2 flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="min-h-0 flex-1 overflow-y-auto">
          <MapSidebarItems
            items={itemRows}
            customItems={customItemRows}
            mapDisplayName={mapDisplayName}
          />
        </TabsContent>
        <TabsContent value="tasks" className="min-h-0 flex-1 overflow-y-auto">
          <MapSidebarTasks normalizedName={normalizedName} searchQuery={searchQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
