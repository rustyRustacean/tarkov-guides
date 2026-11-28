import { GuideChapterList } from "@/features/resources/components/guide/GuideChapterList";
import { ResourceItemPage } from "@/features/resources/components/ResourceItemPage";
import { getGuideChapters } from "@/features/resources/lib/guide-content";
import {
  hostedResourceMetadata,
  requireHostedResource,
} from "@/features/resources/lib/resource-metadata";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

const SLUG = "hidden-mechanics";

export const metadata = hostedResourceMetadata(SLUG);

/** Route entry for the Hidden Mechanics guide: a short intro and the chapter list. */
export default function HiddenMechanicsRoute() {
  return (
    <ResourceItemPage resource={requireHostedResource(SLUG)}>
      <div className="text-muted-foreground mb-6 flex max-w-3xl flex-col gap-3">
        <p>
          A lot of what decides whether you live or die in Tarkov never shows up on screen. This
          guide collects the rules behind it, chapter by chapter, from creators who&apos;ve tested
          and dug into how the game actually works. Every claim links back to its source at the end
          of each chapter, so you can watch the testing yourself and see how recent it is.
        </p>
        <p>
          Looking for how to actually win fights? Start with the{" "}
          <TransitionLink href="/pvp-guide" className="text-primary hover:underline">
            PvP Guide
          </TransitionLink>
          .
        </p>
      </div>
      <GuideChapterList guideSlug={SLUG} chapters={getGuideChapters()} />
    </ResourceItemPage>
  );
}
