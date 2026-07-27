import { ArrowRight } from "lucide-react";

import { InlineMarkdown } from "@/shared/ui/inline-markdown/InlineMarkdown";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { AutoplayVideo } from "./AutoplayVideo";

import type { CondensedGuideSection as CondensedGuideSectionData } from "../lib/pvp-condensed-guide";

interface Props {
  section: CondensedGuideSectionData;
}

/**
 * One Quick Start tier's summary card - ported from
 * `old/tarkov-tips/src/components/pvp/CondensedGuideSection.tsx`, restyled
 * with theme tokens. Deliberately drops the source's `isComplete: false`
 * "Coming Soon" locked-card branch: every section in this port's data is
 * genuinely complete (the 2 orphaned/never-finished source tutorials were
 * excluded from the port entirely, not included as locked placeholders -
 * see the plan's decision #2), so that branch would be permanently dead
 * code with no real path to exercise it.
 */
export function CondensedGuideSection({ section }: Props) {
  return (
    <div
      id={section.tutorialSlug}
      className="bg-card border-border scroll-mt-20 rounded-xl border p-6 shadow-sm"
    >
      <div className="mb-4 flex items-start gap-4">
        <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
          {section.order}
        </div>
        <div className="flex-1">
          <h3 className="font-display text-foreground mb-2 text-xl font-bold">{section.title}</h3>
          <p className="text-muted-foreground leading-relaxed">
            <InlineMarkdown text={section.briefExplanation} />
          </p>
        </div>
      </div>

      {section.videoPath && (
        <div className="mb-6">
          <AutoplayVideo
            src={section.videoPath}
            alt={`${section.title} demonstration`}
            caption={section.videoCaption ?? ""}
          />
        </div>
      )}

      {section.keyPoints.length > 0 && (
        <div className="mb-6">
          <h4 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
            Key Takeaways
          </h4>
          <div className="grid gap-2 md:grid-cols-2">
            {section.keyPoints.map((point) => (
              <div key={point} className="text-muted-foreground flex items-start gap-2 text-sm">
                <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                <span>
                  <InlineMarkdown text={point} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-border border-t pt-4">
        <TransitionLink
          href={`/pvp-guide/${section.tutorialSlug}`}
          className="text-primary hover:text-primary/80 group inline-flex items-center gap-2 font-medium transition-colors"
        >
          <span>Read full detailed guide</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </TransitionLink>
      </div>
    </div>
  );
}
