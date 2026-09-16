"use client";

import { GameDataGate } from "@/shared/lib/tarkov-api/GameDataGate";
import { Badge } from "@/shared/ui/badge/Badge";
import { cn } from "@/shared/ui/lib/cn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { BackupRestorePanel } from "./BackupRestorePanel";
import { BeginnerItemsGuide } from "./BeginnerItemsGuide";
import { HideoutTracker } from "./HideoutTracker";
import { ItemTrackerBoard } from "./ItemTrackerBoard";
import { KappaTracker } from "./KappaTracker";
import { QuestBoard } from "./QuestBoard";

/** Same active-tab accent treatment `MapPicker` established for the Maps feature's map-switcher row: a soft tint of the theme's own accent color (amber on Inventory Grid) plus a hairline ring, instead of the shared `Tabs` default's plain gray "selected" fill. Applied to every `TabsTrigger` below so this page's own top-level tab row matches. */
const accentTabTriggerClassName =
  "[&:not([data-state=active])]:hover:bg-accent data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-primary/30 data-[state=active]:ring-inset";

/**
 * Top-level shell for the Progress Tracker feature: the top-level Quests/
 * Items/Guide/Kappa/Hideout/Backup tab switcher. Unlike an earlier version
 * of this shell, the tabs are always rendered regardless of whether a
 * profile is active. Every profile-scoped panel already shows its own "no
 * active profile" message (`QuestBoard`, `ItemTrackerBoard`, `KappaTracker`,
 * `HideoutTracker`), and gating the whole shell behind one made
 * `BackupRestorePanel` unreachable exactly when it's most useful: a new user
 * with zero profiles importing a backup from another device. The
 * once-on-mount localStorage hydration and the ongoing debounced persistence
 * sync used to be wired up here, but now live in `src/app/providers.tsx`
 * instead (see that file's doc comment): other features (Maps) read this
 * store's active-profile state directly, so hydration needed to become an
 * app-wide concern rather than something only active while this specific
 * page happened to be mounted.
 */
export function ProgressTrackerPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      <Tabs defaultValue="quests" className="flex flex-col gap-4">
        {/* Items/Guide/Kappa/Hideout are built and otherwise working, but temporarily disabled
            and WIP-badged here pending sign-off. Not a real "unfinished feature" gate.
            Revert `disabled`/the Badge together to re-enable. */}
        <TabsList>
          <TabsTrigger value="quests" className={accentTabTriggerClassName}>
            Quests
          </TabsTrigger>
          <TabsTrigger value="items" disabled className={cn("gap-1.5", accentTabTriggerClassName)}>
            Items
            <Badge variant="secondary">WIP</Badge>
          </TabsTrigger>
          <TabsTrigger value="guide" disabled className={cn("gap-1.5", accentTabTriggerClassName)}>
            Guide
            <Badge variant="secondary">WIP</Badge>
          </TabsTrigger>
          <TabsTrigger value="kappa" disabled className={cn("gap-1.5", accentTabTriggerClassName)}>
            Kappa
            <Badge variant="secondary">WIP</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="hideout"
            disabled
            className={cn("gap-1.5", accentTabTriggerClassName)}
          >
            Hideout
            <Badge variant="secondary">WIP</Badge>
          </TabsTrigger>
          <TabsTrigger value="backup" className={accentTabTriggerClassName}>
            Backup
          </TabsTrigger>
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
