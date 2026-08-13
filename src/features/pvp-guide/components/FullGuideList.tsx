import { ArrowRight } from "lucide-react";

import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import type { LearningPathItemWithTutorial } from "../lib/pvp-learning-path";

interface Props {
  items: readonly LearningPathItemWithTutorial[];
}

/**
 * The Full Guide tab's content: a flat, full-width list of every chapter in
 * reading order, title-only. Replaces the earlier tier-grouped
 * `TutorialTierSection` layout per user request, closer to `old/tarkov-tips`'s
 * simple list. Uses links rather than expanding content in place so
 * `TransitionLink`'s view-transition animation applies when navigating to
 * the full article.
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
