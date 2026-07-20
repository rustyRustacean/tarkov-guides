import { PVP_CONDENSED_GUIDE } from "../lib/pvp-condensed-guide";

import { CondensedGuideSection } from "./CondensedGuideSection";

/** The "Quick Start" tab's content - maps {@link PVP_CONDENSED_GUIDE} to a list of summary cards. Ported from `old/tarkov-tips/src/components/pvp/CondensedGuide.tsx`. */
export function CondensedGuide() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-foreground text-2xl font-bold">
          Quick Start: The Essentials
        </h2>
        <p className="text-muted-foreground mt-1">
          A condensed pass over every technique in this guide. Read this first, or dive into the
          Full Guide tab for the complete write-up on anything you want to master.
        </p>
      </div>
      {PVP_CONDENSED_GUIDE.map((section) => (
        <CondensedGuideSection key={section.tutorialSlug} section={section} />
      ))}
    </div>
  );
}
