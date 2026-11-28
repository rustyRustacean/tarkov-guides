import { ArrowRight } from "lucide-react";

import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import type { GuideChapter } from "../../lib/guide-content";

/** A guide's chapters in reading order, as numbered cards linking to each chapter. */
export function GuideChapterList({
  guideSlug,
  chapters,
}: {
  guideSlug: string;
  chapters: readonly GuideChapter[];
}) {
  return (
    <ol className="flex max-w-3xl flex-col gap-3">
      {chapters.map((chapter, index) => (
        <li key={chapter.slug}>
          <TransitionLink
            href={`/resources/${guideSlug}/${chapter.slug}`}
            className="border-border bg-card hover:border-primary/50 focus-visible:ring-ring group flex items-start gap-4 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span className="bg-primary/15 text-primary font-display flex size-9 shrink-0 items-center justify-center rounded-md text-lg font-bold tabular-nums">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-foreground font-medium">{chapter.frontmatter.title}</span>
              <span className="text-muted-foreground text-sm">
                {chapter.frontmatter.description}
              </span>
              <span className="text-muted-foreground text-xs">
                {chapter.readingTimeMinutes} min read
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="text-muted-foreground group-hover:text-primary mt-1 size-4 shrink-0 transition-colors"
            />
          </TransitionLink>
        </li>
      ))}
    </ol>
  );
}
