import Image from "next/image";

import { RiverHero } from "@/features/home/components/RiverHero";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card/Card";
import { cn } from "@/shared/ui/lib/cn";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

interface ComingSoonFeature {
  title: string;
  description: string;
  imageSrc: string;
}

type PhotoFeatureCardProps = {
  title: string;
  description: string;
  imageSrc: string;
} & (
  | { comingSoon: true; tags?: never; href?: never; cta?: never }
  | { comingSoon?: false; tags: readonly string[]; href: string; cta: string }
);

const TEXT_SHADOW = "[text-shadow:0_1px_4px_rgba(0,0,0,0.55)]";

/**
 * A feature card with a full-bleed photo background instead of `Card`'s
 * flat surface - used for every card in the "Everything in One Place" grid,
 * real and Coming Soon alike. The old bullet lists don't survive legibly on
 * top of a photo, so live cards trade them for a short tag-chip row
 * instead; full detail is still one click away on the feature's own page
 * either way.
 *
 * `comingSoon` desaturates the photo and dims the scrim further on top of
 * the usual dashed-border/reduced-opacity treatment those cards already
 * used - two independent signals (art treatment + chrome) that this card
 * isn't a real link, matching the disabled `Button` it renders instead of
 * a `TransitionLink`.
 *
 * `from-card`/`via-card` (not a hardcoded color) keeps the scrim
 * theme-correct across all 6 themes, the same way every other themed
 * surface here is - `--color-card` repoints per `[data-theme]` for free.
 *
 * Every `public/images/home/*.jpg` this renders is placeholder photography
 * (Pexels License, free to use) standing in for real in-game captures -
 * swap the files in place, no code change needed.
 *
 * Live cards get a subtle `motion-safe:group-hover:scale-105` image zoom -
 * skipped on Coming Soon cards (no `group` class at all there) since they
 * have nothing to click through to, and a hover reaction on an inert card
 * would read as more interactive than it actually is.
 */
function PhotoFeatureCard({
  title,
  description,
  imageSrc,
  comingSoon,
  tags,
  href,
  cta,
}: PhotoFeatureCardProps) {
  return (
    <Card
      className={cn("relative overflow-hidden", comingSoon ? "border-dashed opacity-90" : "group")}
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className={cn(
          "object-cover transition-transform duration-300",
          comingSoon ? "grayscale" : "motion-safe:group-hover:scale-105",
        )}
      />
      <div
        className={cn(
          "from-card via-card/90 absolute inset-0 bg-gradient-to-t from-0% via-45% to-transparent",
          comingSoon && "via-card/95 to-card/25",
        )}
      />
      <div className="relative flex min-h-80 flex-col justify-end gap-3 p-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className={TEXT_SHADOW}>{title}</CardTitle>
          {comingSoon && <Badge variant="secondary">Coming Soon</Badge>}
        </div>
        <CardDescription className={TEXT_SHADOW}>{description}</CardDescription>
        {!comingSoon && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-background/60 backdrop-blur-sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {comingSoon ? (
          <Button
            variant="outline"
            disabled
            className="bg-background/60 self-start backdrop-blur-sm"
          >
            Coming Soon
          </Button>
        ) : (
          <Button asChild className="self-start">
            <TransitionLink href={href}>{cta}</TransitionLink>
          </Button>
        )}
      </div>
    </Card>
  );
}

// Most "Coming Soon" cards mirror a real section from one (or both) of the
// two legacy sites this project merges - see `src/features/*/README.md` for
// each area's exact migration provenance. Quick Tips is the exception - a
// new, smaller-scope replacement for the long-form Tutorials section
// originally planned, not ported from either legacy site. Deliberately no
// destination routes yet (per this task's scope) - each renders as an inert,
// disabled action.
const COMING_SOON_FEATURES: ComingSoonFeature[] = [
  {
    title: "10 Quick Tips",
    description:
      "A quick-hit list of ten actionable tips - best stims to run, recommended settings, and a few videos worth watching.",
    imageSrc: "/images/home/quick-tips-card.jpg",
  },
  {
    title: "Ballistics Calculator",
    description: "Check ammo penetration chance and damage against every armor plate and rig.",
    imageSrc: "/images/home/ballistics-card.jpg",
  },
  {
    title: "Flea Market Tools",
    description: "Search and price-check any item on the flea market, PvP and PvE side by side.",
    imageSrc: "/images/home/flea-market-card.jpg",
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
        <div className="relative z-10 mx-auto max-w-3xl px-4 pt-24 pb-12 sm:pt-32 sm:pb-16">
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

      {/* `scroll-mt-14` matches the sticky header's `h-14` exactly, so the
          hero's "See What's Included" anchor jump (and any other in-page
          link to this section) lands with the heading fully clear of the
          header instead of tucked underneath it. `py-12` matches every
          other page's top-level container (`ProgressTrackerPage`,
          `FAQPage`, `PvpGuidePage`, ...) - this used to be the one `py-16`
          outlier, which also stacked with the hero's own bottom padding
          into an oversized gap between the two sections. */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-12">
        <h2 className="font-display mb-8 text-2xl font-bold">Everything in One Place</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PhotoFeatureCard
            title="Progress Tracker"
            description="Track everything about your current wipe in one place."
            tags={["Quests", "Items", "Hideout", "Kappa"]}
            href="/progress-tracker"
            cta="Open Progress Tracker →"
            imageSrc="/images/home/progress-tracker-card.jpg"
          />

          <PhotoFeatureCard
            title="PvP Guide"
            description="A tiered Essential → Intermediate → Advanced learning path for PvP combat."
            tags={["Quick Start", "Full Guide"]}
            href="/pvp-guide"
            cta="Open PvP Guide →"
            imageSrc="/images/home/pvp-guide-card.jpg"
          />

          <PhotoFeatureCard
            title="Maps"
            description="Interactive maps for every location, with live quest markers, boss spawns, and your own annotations."
            tags={["Quest markers", "Annotations", "Boss & raid info"]}
            href="/maps"
            cta="Open Maps →"
            imageSrc="/images/home/maps-card.jpg"
          />

          <PhotoFeatureCard
            title="External Resources"
            description="Community-run maps, guides, and tools worth knowing about beyond TarkovGuides."
            tags={["Arena & 3D maps", "Boss tracker", "Tarkov.dev tools"]}
            href="/external-resources"
            cta="Open External Resources →"
            imageSrc="/images/home/external-resources-card.jpg"
          />

          {COMING_SOON_FEATURES.map((feature) => (
            <PhotoFeatureCard
              key={feature.title}
              comingSoon
              title={feature.title}
              description={feature.description}
              imageSrc={feature.imageSrc}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
