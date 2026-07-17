import { RiverHero } from "@/features/home/components/RiverHero";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card/Card";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

interface ComingSoonFeature {
  title: string;
  description: string;
}

// Every "Coming Soon" card mirrors a real section from one (or both) of the
// two legacy sites this project merges - see `src/features/*/README.md` for
// each area's exact migration provenance. Deliberately no destination routes
// yet (per this task's scope) - each renders as an inert, disabled action.
const COMING_SOON_FEATURES: ComingSoonFeature[] = [
  {
    title: "Tutorials",
    description:
      "Long-form guides covering beginner fundamentals, weapon builds, map knowledge, quests, and the flea market economy.",
  },
  {
    title: "Ballistics Calculator",
    description: "Check ammo penetration chance and damage against every armor plate and rig.",
  },
  {
    title: "Flea Market Tools",
    description: "Search and price-check any item on the flea market, PvP and PvE side by side.",
  },
];

/**
 * The site homepage. Synthesizes both legacy sites' homepages - the
 * animated hero and tutorial-category framing from `old/tarkov-tips`, and
 * the feature-card + "More Tools" list from `old/TarkovTrackerWB-main` -
 * into one professional landing page. Stays a server component; only
 * `RiverHero` (the ported canvas animation) needs `"use client"`.
 */
export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden">
        {/* Positioned first (behind, via normal DOM/paint order) rather
            than via a negative z-index - `[data-theme="inventory"]` sets
            its own `background` directly on `<html>`, which can otherwise
            outrank a negatively-z-indexed descendant depending on which
            ancestor establishes the nearest stacking context. Plain DOM
            order + a positive z-index on the content above it is stacking-
            context-proof regardless of any theme's page-level CSS. */}
        <div className="absolute inset-0">
          <RiverHero />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-24 sm:py-32">
          {/* Blur band behind the text: a *gradient* of blur, not a bounded
              card - ultra clear at the left/right edges, a light, constant
              level of blur directly behind the text, fading back to clear
              on each side. `mask-image` (not `opacity`) fades the blur
              layer itself, so the un-blurred animation shows through at the
              edges rather than the layer just becoming a lighter box. No
              top/bottom fade - only left/right, so there's no visible card
              edge above/below the text either. */}
          <div
            className="bg-background/20 absolute -inset-x-10 inset-y-0 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] backdrop-blur-[3px] [-webkit-mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center gap-6 text-center">
            <Badge variant="outline">Community-run · Not affiliated with Battlestate Games</Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Master{" "}
              <span className="from-primary to-status-teal bg-gradient-to-r bg-clip-text text-transparent">
                Escape from Tarkov
              </span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-lg">
              Comprehensive guides and tools for every aspect of Tarkov
            </p>
            {/* Points at PvP Guide, not Progress Tracker - PvP Guide is the
                area currently being actively promoted; Progress Tracker
                still has its own CTA on its feature card below. */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg">
                <TransitionLink href="/pvp-guide">Open PvP Guide</TransitionLink>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#features">See What&apos;s Included</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display mb-8 text-2xl font-bold">Everything in One Place</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Progress Tracker</CardTitle>
              <CardDescription>
                Track everything about your current wipe in one place.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
                <li>
                  <span className="text-foreground font-medium">Quests</span> - task list,
                  dependency tree, trader groups, and priority recommendations
                </li>
                <li>
                  <span className="text-foreground font-medium">Items</span> - stash have/pending
                  tracking with flea-market tax math and raid commit
                </li>
                <li>
                  <span className="text-foreground font-medium">Guide</span> - curated beginner
                  items and where to find them
                </li>
                <li>
                  <span className="text-foreground font-medium">Kappa</span> - Collector task and
                  hideout item checklist
                </li>
                <li>
                  <span className="text-foreground font-medium">Hideout</span> - upgrade tracking
                  with goal-path planning
                </li>
                <li>
                  <span className="text-foreground font-medium">Backup</span> - multi-profile
                  support with JSON export/import
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <TransitionLink href="/progress-tracker">Open Progress Tracker →</TransitionLink>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PvP Guide</CardTitle>
              <CardDescription>
                A tiered Essential → Intermediate → Advanced learning path for PvP combat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground grid gap-2 text-sm">
                <li>
                  <span className="text-foreground font-medium">Quick Start</span> - condensed
                  key-takeaway summary of every technique
                </li>
                <li>
                  <span className="text-foreground font-medium">Full Guide</span> - 6 in-depth
                  tutorials from movement basics to combat integration (coming soon)
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <TransitionLink href="/pvp-guide">Open PvP Guide →</TransitionLink>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maps</CardTitle>
              <CardDescription>
                Interactive maps for every location, with live quest markers, boss spawns, and your
                own annotations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground grid gap-2 text-sm">
                <li>
                  <span className="text-foreground font-medium">Variants</span> - Interactable, 2D,
                  and 3D views, plus your own custom map uploads
                </li>
                <li>
                  <span className="text-foreground font-medium">Quest markers</span> - live
                  objective locations pulled from your active tasks
                </li>
                <li>
                  <span className="text-foreground font-medium">Annotations</span> - freehand
                  drawing and lock zones, saved per profile
                </li>
                <li>
                  <span className="text-foreground font-medium">Boss &amp; raid info</span> - spawn
                  strip plus a live in-game clock
                </li>
                <li>
                  <span className="text-foreground font-medium">Sidebar</span> - map-relevant
                  Items/Tasks and a Valuables panel
                </li>
                <li>
                  <span className="text-foreground font-medium">Fullscreen</span> - dedicated
                  fullscreen map mode
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <TransitionLink href="/maps">Open Maps →</TransitionLink>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>External Resources</CardTitle>
              <CardDescription>
                Community-run maps, guides, and tools worth knowing about beyond TarkovGuides.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground grid gap-2 text-sm">
                <li>
                  <span className="text-foreground font-medium">Arena &amp; 3D maps</span> -
                  interactive Arena maps and fully explorable 3D raid maps
                </li>
                <li>
                  <span className="text-foreground font-medium">Boss tracker</span> - live boss
                  spawn chance and location tracking
                </li>
                <li>
                  <span className="text-foreground font-medium">Tarkov.dev tools</span> - player
                  lookup, barter profit, and other calculators
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <TransitionLink href="/external-resources">
                  Open External Resources →
                </TransitionLink>
              </Button>
            </CardFooter>
          </Card>

          {COMING_SOON_FEATURES.map((feature) => (
            <Card key={feature.title} className="border-dashed opacity-75">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{feature.title}</CardTitle>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" disabled>
                  Coming Soon
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
