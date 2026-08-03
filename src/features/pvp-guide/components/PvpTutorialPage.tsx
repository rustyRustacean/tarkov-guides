import { ArrowLeft, ArrowRight } from "lucide-react";

import { Badge, type BadgeProps } from "@/shared/ui/badge/Badge";
import { Progress } from "@/shared/ui/progress/Progress";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { VideoDisclaimerNotice } from "./VideoDisclaimerNotice";

import type { LearningPathItemWithTutorial } from "../lib/pvp-learning-path";
import type { PvpTutorial } from "../types";
import type { ReactElement } from "react";

const DIFFICULTY_BADGE_VARIANT: Record<
  PvpTutorial["frontmatter"]["difficulty"],
  NonNullable<BadgeProps["variant"]>
> = {
  beginner: "green",
  intermediate: "amber",
  advanced: "red",
};

interface Props {
  tutorial: PvpTutorial;
  content: ReactElement;
  previous: LearningPathItemWithTutorial | null;
  next: LearningPathItemWithTutorial | null;
  progress: { current: number; total: number; percentage: number };
}

/**
 * One PvP tutorial's detail page - a from-scratch layout (the source split
 * this across `old/tarkov-tips/src/app/tutorials/[slug]/page.tsx`, a
 * generic multi-category tutorial page this project isn't building - see
 * the plan's decision #1) that adds real prev/next navigation + a progress
 * bar by finally wiring up `lib/pvp-learning-path.ts`'s
 * `getNextTutorialInPath`/`getPreviousTutorialInPath`/
 * `getTutorialProgressInPath` helpers, which existed in the source but were
 * never called from anywhere.
 */
export function PvpTutorialPage({ tutorial, content, previous, next, progress }: Props) {
  const { frontmatter } = tutorial;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <VideoDisclaimerNotice />

      <nav className="text-muted-foreground mb-6 flex flex-wrap items-center gap-2 text-sm">
        <TransitionLink href="/" className="hover:text-foreground transition-colors">
          Home
        </TransitionLink>
        <span>/</span>
        <TransitionLink href="/pvp-guide" className="hover:text-foreground transition-colors">
          PvP Guide
        </TransitionLink>
        <span>/</span>
        <span className="text-foreground">{frontmatter.title}</span>
      </nav>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={DIFFICULTY_BADGE_VARIANT[frontmatter.difficulty]}>
            {frontmatter.difficulty}
          </Badge>
          <span className="text-muted-foreground">
            Tutorial {progress.current} of {progress.total}
          </span>
        </div>
        <h1 className="font-display text-foreground text-3xl font-bold">{frontmatter.title}</h1>
        <p className="text-muted-foreground mt-2 text-lg">{frontmatter.description}</p>
        <Progress value={progress.percentage} className="mt-4" />
      </header>

      {/* No `dark:prose-invert` - this project themes via `[data-theme]`
          CSS custom properties, not Tailwind's separate dark-mode variant.
          `.prose`'s `--tw-prose-*` overrides (`globals.css`) already point
          at this project's own tokens, which already resolve correctly per
          theme - stacking `dark:prose-invert` on top would silently
          re-override them based on the OS `prefers-color-scheme` media
          query instead, independent of (and inconsistent with) whichever
          theme is actually active. */}
      <article className="prose max-w-none">{content}</article>

      <div className="border-border mt-10 grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-3">
        {previous?.tutorial ? (
          <TransitionLink
            href={`/pvp-guide/${previous.tutorialSlug}`}
            className="border-border hover:border-primary/50 focus-visible:ring-ring flex flex-col justify-center gap-1 rounded-lg border p-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span className="text-muted-foreground flex items-center gap-1">
              <ArrowLeft className="size-3.5" />
              Previous
            </span>
            <span className="text-foreground font-medium">
              {previous.tutorial.frontmatter.title}
            </span>
          </TransitionLink>
        ) : (
          <div />
        )}

        <TransitionLink
          href="/pvp-guide"
          className="border-border hover:border-primary/50 focus-visible:ring-ring flex items-center justify-center rounded-lg border p-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Back to PvP Guide
        </TransitionLink>

        {next?.tutorial ? (
          <TransitionLink
            href={`/pvp-guide/${next.tutorialSlug}`}
            className="border-border hover:border-primary/50 focus-visible:ring-ring flex flex-col items-end justify-center gap-1 rounded-lg border p-3 text-right text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span className="text-muted-foreground flex items-center gap-1">
              Next
              <ArrowRight className="size-3.5" />
            </span>
            <span className="text-foreground font-medium">{next.tutorial.frontmatter.title}</span>
          </TransitionLink>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
