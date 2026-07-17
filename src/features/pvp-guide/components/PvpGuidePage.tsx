import { BookOpen, Sword, Zap } from "lucide-react";

import { Badge } from "@/shared/ui/badge/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { getPvpLearningPathWithTutorials, PVP_LEARNING_PATH } from "../lib/pvp-learning-path";

import { CondensedGuide } from "./CondensedGuide";
import { TutorialTierSection } from "./TutorialTierSection";

/**
 * The PvP Guide hub - ported from
 * `old/tarkov-tips/src/app/pvp-guide/page.tsx` + `PVPGuideClient.tsx`,
 * merged into one component and restyled with this project's design
 * system. A plain server component (unlike the source's `'use client'`
 * version): it has no state of its own to manage - `Tabs` (Radix, already
 * a Client Component) owns the Quick Start/Full Guide switch internally,
 * so nothing here needs to cross the client boundary.
 */
export function PvpGuidePage() {
  const items = getPvpLearningPathWithTutorials();
  const essential = items.filter((item) => item.tier === "essential");
  const intermediate = items.filter((item) => item.tier === "intermediate");
  const advanced = items.filter((item) => item.tier === "advanced");
  const totalHours = Math.round((PVP_LEARNING_PATH.totalTime / 60) * 10) / 10;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <nav className="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
        <TransitionLink href="/" className="hover:text-foreground transition-colors">
          Home
        </TransitionLink>
        <span>/</span>
        <span className="text-foreground">PvP Guide</span>
      </nav>

      <div className="bg-primary text-primary-foreground mb-8 rounded-xl p-8 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <Sword className="size-10" />
          <Badge variant="secondary">Quick Guide</Badge>
        </div>
        <h1 className="font-display text-3xl font-bold">{PVP_LEARNING_PATH.title}</h1>
        <p className="mt-3 text-lg opacity-90">{PVP_LEARNING_PATH.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm opacity-90">
          <span>{items.length} tutorials</span>
          <span>{totalHours} hours total</span>
          <span>{essential.length} essential</span>
          <span>{intermediate.length} intermediate</span>
          <span>{advanced.length} advanced</span>
        </div>
      </div>

      <Tabs defaultValue="quick" className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="quick" className="gap-2">
            <Zap className="size-4" />
            Quick Start
          </TabsTrigger>
          {/* Disabled: only the Quick Start content is ready to publish right
              now - the Full Guide's tier sections below stay wired up (real
              tutorial content already exists) so re-enabling this is just
              dropping `disabled` once that content is ready to ship. */}
          <TabsTrigger value="full" className="gap-2" disabled>
            <BookOpen className="size-4" />
            Full Guide
            <span className="text-[10px] font-semibold tracking-wide uppercase">TBA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quick">
          <CondensedGuide />
        </TabsContent>

        <TabsContent value="full" className="flex flex-col gap-8">
          <TutorialTierSection tier="essential" items={essential} />
          <TutorialTierSection tier="intermediate" items={intermediate} />
          <TutorialTierSection tier="advanced" items={advanced} />

          <div className="bg-card border-border rounded-xl border p-6 shadow-sm">
            <h3 className="text-foreground mb-4 font-semibold">How to Use This Guide</h3>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div>
                <h4 className="text-status-green mb-1 font-medium">Essential First</h4>
                <p className="text-muted-foreground">
                  Master both essential tutorials completely before moving to intermediate
                  techniques - they form your foundation.
                </p>
              </div>
              <div>
                <h4 className="text-status-amber mb-1 font-medium">Intermediate Progression</h4>
                <p className="text-muted-foreground">
                  Build combat skills with positioning, advanced peeking, and tactical information
                  warfare. Practice each thoroughly.
                </p>
              </div>
              <div>
                <h4 className="text-status-red mb-1 font-medium">Advanced Integration</h4>
                <p className="text-muted-foreground">
                  Master movement integration and equipment optimization for complete PvP dominance.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
