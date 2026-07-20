import { ArrowRight } from "lucide-react";

import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import type { LearningPathItemWithTutorial } from "../lib/pvp-learning-path";

interface Props {
  items: readonly LearningPathItemWithTutorial[];
}

/**
 * The Full Guide tab's content - a flat, full-width list of every chapter in
 * reading order, title-only. Replaces the earlier tier-grouped
 * `TutorialTierSection` (order badge + title + time + difficulty badge +
 * description per card, grouped under Essential/Intermediate/Advanced
 * headings) per the user's request for something closer to a plain site
 * index, similar to `old/tarkov-tips`'s simpler list styling - each row is
 * just an order badge and a title, letting `TransitionLink`'s existing
 * view-transition wrapping supply the "clean animation" into the full
 * article page rather than expanding content in place.
 */
export function FullGuideList({ items }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) =>
        item.tutorial ? (
          <TransitionLink
            key={item.tutorialSlug}
            href={`/pvp-guide/${item.tutorialSlug}`}
            className="group bg-card border-border hover:border-primary/50 flex w-full items-center gap-4 rounded-lg border p-4 shadow-sm transition-colors hover:shadow-md"
          >
            <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              {item.order}
            </div>
            <h3 className="text-foreground group-hover:text-primary flex-1 font-semibold transition-colors">
              {item.tutorial.frontmatter.title}
            </h3>
            <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform group-hover:translate-x-1" />
          </TransitionLink>
        ) : null,
      )}
    </div>
  );
}
