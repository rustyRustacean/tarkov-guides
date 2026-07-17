"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { MapRecommendationDialog } from "./MapRecommendationDialog";
import { QuestAnalyticsPanel } from "./QuestAnalyticsPanel";
import { QuestList } from "./QuestList";
import { QuestRecommendations } from "./QuestRecommendations";
import { QuestTreeView } from "./QuestTreeView";
import { TraderTaskBoard } from "./TraderTaskBoard";

/**
 * Quests tab container - view-mode switcher (List / Tree / Trader /
 * Recommendations / Analytics). Defaults to Tree (2026-07-16 redesign) - the
 * trader-lane graph gives a better at-a-glance sense of what's actually
 * reachable than the flat list does, so it leads. A "What map do I go to?"
 * trigger sits to the right of the tab row (mirrors `ProgressTrackerPage`'s
 * title/`ProfileSwitcher` flex-row pattern) opening `MapRecommendationDialog`
 * - useful regardless of which view mode is currently active, so it lives
 * here rather than inside any one view.
 */
export function QuestBoard() {
  const [mapDialogOpen, setMapDialogOpen] = useState(false);

  return (
    <Tabs defaultValue="tree" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="tree">Tree</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="trader">Trader</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

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
        <QuestTreeView />
      </TabsContent>
      <TabsContent value="list">
        <QuestList />
      </TabsContent>
      <TabsContent value="trader">
        <TraderTaskBoard />
      </TabsContent>
      <TabsContent value="recommendations">
        <QuestRecommendations />
      </TabsContent>
      <TabsContent value="analytics">
        <QuestAnalyticsPanel />
      </TabsContent>
    </Tabs>
  );
}
