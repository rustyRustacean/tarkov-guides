import { ArrowLeft, ArrowRight } from "lucide-react";

import { Badge } from "@/shared/ui/badge/Badge";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { formatSourceDate, type SourcedCitation } from "../../lib/guide-citations";

import { GuideSources } from "./GuideSources";

import type { HostedResource } from "../../data/resources";
import type { GuideChapter } from "../../lib/guide-content";
import type { ReactElement } from "react";

const NAV_CARD =
  "border-border hover:border-primary/50 focus-visible:ring-ring flex flex-col justify-center gap-1 rounded-lg border p-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * One chapter of a hosted guide: breadcrumb back through the guide to the
 * hub, the compiled MDX, the chapter's sources, then previous and next.
 * Laid out like the PvP guide's tutorial pages so long reads feel the same
 * across the site.
 */
export function GuideChapterPage({
  guide,
  chapter,
  chapterNumber,
  content,
  citations,
  previous,
  next,
}: {
  guide: HostedResource;
  chapter: GuideChapter;
  chapterNumber: number;
  content: ReactElement;
  citations: readonly SourcedCitation[];
  previous: GuideChapter | undefined;
  next: GuideChapter | undefined;
}) {
  const guideHref = `/resources/${guide.slug}`;
  const { frontmatter } = chapter;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-muted-foreground mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <TransitionLink href="/" className="hover:text-foreground transition-colors">
              Home
            </TransitionLink>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <TransitionLink href="/resources" className="hover:text-foreground transition-colors">
              Resources
            </TransitionLink>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <TransitionLink href={guideHref} className="hover:text-foreground transition-colors">
              {guide.title}
            </TransitionLink>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {frontmatter.title}
          </li>
        </ol>
      </nav>

      <header className="mb-8">
        <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">Chapter {chapterNumber}</Badge>
          <span>{chapter.readingTimeMinutes} min read</span>
          <span aria-hidden="true">·</span>
          <span>Updated {formatSourceDate(frontmatter.updatedAt)}</span>
        </div>
        <h1 className="font-display text-foreground text-3xl font-bold">{frontmatter.title}</h1>
        <p className="text-muted-foreground mt-2 text-lg">{frontmatter.description}</p>
      </header>

      {/* No `dark:prose-invert`, for the same reason as `PvpTutorialPage`: the
          `.prose` colors already follow the active `[data-theme]`. */}
      <article className="prose max-w-none">{content}</article>

      <GuideSources citations={citations} />

      <div className="border-border mt-10 grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-3">
        <NavCard guideHref={guideHref} chapter={previous} direction="previous" />
        <TransitionLink href={guideHref} className={`${NAV_CARD} items-center font-medium`}>
          All chapters
        </TransitionLink>
        <NavCard guideHref={guideHref} chapter={next} direction="next" />
      </div>
    </div>
  );
}

/** The previous or next chapter's card, or an empty grid cell at either end of the guide. */
function NavCard({
  guideHref,
  chapter,
  direction,
}: {
  guideHref: string;
  chapter: GuideChapter | undefined;
  direction: "previous" | "next";
}) {
  if (!chapter) return <div />;
  const isNext = direction === "next";
  return (
    <TransitionLink
      href={`${guideHref}/${chapter.slug}`}
      className={isNext ? `${NAV_CARD} items-end text-right` : NAV_CARD}
    >
      <span className="text-muted-foreground flex items-center gap-1">
        {!isNext && <ArrowLeft className="size-3.5" />}
        {isNext ? "Next" : "Previous"}
        {isNext && <ArrowRight className="size-3.5" />}
      </span>
      <span className="text-foreground font-medium">{chapter.frontmatter.title}</span>
    </TransitionLink>
  );
}
