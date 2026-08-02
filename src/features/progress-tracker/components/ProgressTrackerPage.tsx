"use client";

import { GameDataGate } from "@/shared/lib/tarkov-api/GameDataGate";
import { Badge } from "@/shared/ui/badge/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { BackupRestorePanel } from "./BackupRestorePanel";
import { BeginnerItemsGuide } from "./BeginnerItemsGuide";
import { HideoutTracker } from "./HideoutTracker";
import { ItemTrackerBoard } from "./ItemTrackerBoard";
import { KappaTracker } from "./KappaTracker";
import { QuestBoard } from "./QuestBoard";

/** A tab label with a "WIP" badge - used while its panel is disabled below. */
function WipTabLabel({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {children}{" "}
      <Badge variant="amber" className="px-1.5 py-0 text-[10px]">
        WIP
      </Badge>
    </span>
  );
}

/**
 * Top-level shell for the Progress Tracker feature - the top-level Quests/
 * Items/Guide/Kappa/Hideout/Backup tab switcher. Unlike an earlier version
 * of this shell, the tabs are always rendered regardless of whether a
 * profile is active - every profile-scoped panel already shows its own "no
 * active profile" message (`QuestBoard`, `ItemTrackerBoard`, `KappaTracker`,
 * `HideoutTracker`), and gating the whole shell behind one made
 * `BackupRestorePanel` unreachable exactly when it's most useful: a new user
 * with zero profiles importing a backup from another device. The
 * once-on-mount localStorage hydration and the ongoing debounced persistence
 * sync used to be wired up here, but now live in `src/app/providers.tsx`
 * instead (see that file's doc comment) - other features (Maps) read this
 * store's active-profile state directly, so hydration needed to become an
 * app-wide concern rather than something only active while this specific
 * page happened to be mounted.
 *
 * Items/Guide/Kappa/Hideout are mid-rework: their `TabsTrigger`s are
 * `disabled` (Radix skips disabled triggers for both click and roving-focus
 * keyboard nav, so their panels are unreachable) and labeled with a "WIP"
 * badge until that work lands. Remove `disabled` and `WipTabLabel` per tab
 * to bring one back online.
 */
export function ProgressTrackerPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12">
      <div>
        <h1 className="font-display text-3xl font-semibold">Progress Tracker</h1>
        <p className="text-muted-foreground mt-2">
          Track quests, stash items, hideout upgrades, and Kappa collection across your profiles.
        </p>
      </div>

      <Tabs defaultValue="quests" className="mt-8 flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="quests">Quests</TabsTrigger>
          <TabsTrigger value="items" disabled>
            <WipTabLabel>Items</WipTabLabel>
          </TabsTrigger>
          <TabsTrigger value="guide" disabled>
            <WipTabLabel>Guide</WipTabLabel>
          </TabsTrigger>
          <TabsTrigger value="kappa" disabled>
            <WipTabLabel>Kappa</WipTabLabel>
          </TabsTrigger>
          <TabsTrigger value="hideout" disabled>
            <WipTabLabel>Hideout</WipTabLabel>
          </TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>
        <TabsContent value="quests">
          <GameDataGate>
            <QuestBoard />
          </GameDataGate>
        </TabsContent>
        <TabsContent value="items">
          <GameDataGate>
            <ItemTrackerBoard />
          </GameDataGate>
        </TabsContent>
        <TabsContent value="guide">
          <GameDataGate>
            <BeginnerItemsGuide />
          </GameDataGate>
        </TabsContent>
        <TabsContent value="kappa">
          <GameDataGate>
            <KappaTracker />
          </GameDataGate>
        </TabsContent>
        <TabsContent value="hideout">
          <GameDataGate>
            <HideoutTracker />
          </GameDataGate>
        </TabsContent>
        <TabsContent value="backup">
          <BackupRestorePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
