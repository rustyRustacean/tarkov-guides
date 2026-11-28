import { ArrowRight, BookOpen, Cog, Zap } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { getPvpLearningPathWithTutorials, PVP_LEARNING_PATH } from "../lib/pvp-learning-path";

import { CondensedGuide } from "./CondensedGuide";
import { FullGuideList } from "./FullGuideList";
import { VideoDisclaimerNotice } from "./VideoDisclaimerNotice";

/**
 * The PvP Guide hub, ported from
 * `old/tarkov-tips/src/app/pvp-guide/page.tsx` + `PVPGuideClient.tsx`,
 * merged into one component and restyled with this project's design
 * system. A plain server component (unlike the source's `'use client'`
 * version): it has no state of its own to manage. `Tabs` (Radix, already
 * a Client Component) owns the Quick Start/Full Guide switch internally,
 * so nothing here needs to cross the client boundary.
 */
export function PvpGuidePage() {
  const items = getPvpLearningPathWithTutorials();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <VideoDisclaimerNotice />

      <nav className="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
        <TransitionLink href="/" className="hover:text-foreground transition-colors">
          Home
        </TransitionLink>
        <span>/</span>
        <span className="text-foreground">PvP Guide</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">{PVP_LEARNING_PATH.title}</h1>
        <p className="text-muted-foreground mt-3 text-lg">{PVP_LEARNING_PATH.description}</p>
      </div>

      <TransitionLink
        href="/resources/hidden-mechanics"
        className="border-border bg-card hover:border-primary/50 focus-visible:ring-ring group mb-8 flex items-center gap-4 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          <Cog className="size-5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-foreground font-medium">
            Want to know what&apos;s under the hood?
          </span>
          <span className="text-muted-foreground text-sm">
            Hidden Mechanics covers how bots actually spot you, where damage goes, and what your
            bullets do to cover.
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
        />
      </TransitionLink>

      <Tabs defaultValue="quick" className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger
            value="quick"
            className="[&:not([data-state=active])]:hover:bg-accent data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:ring-primary/30 gap-2 data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-inset"
          >
            <Zap className="size-4" />
            Quick Start
          </TabsTrigger>
          <TabsTrigger
            value="full"
            className="[&:not([data-state=active])]:hover:bg-accent data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:ring-primary/30 gap-2 data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-inset"
          >
            <BookOpen className="size-4" />
            Full Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quick">
          <CondensedGuide />
        </TabsContent>

        <TabsContent value="full">
          <FullGuideList items={items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
