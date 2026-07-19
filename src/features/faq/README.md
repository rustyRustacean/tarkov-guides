# FAQ

A single page of frequently asked questions. Each question is its own `FAQItem` card that
expands independently on click to reveal its answer, pushing later questions down via normal
block flow (no accordion library, no "only one open at a time" behavior) - `FAQItem.tsx` hand-rolls
this the same way `ItemLocationHint`/`AboutLink` already do elsewhere in this codebase, rather than
pulling in `@radix-ui/react-accordion` (not currently a dependency) for one page.

Content, in order (first/last positions are a user requirement, the rest were judged useful for
this specific site rather than generic filler):

1. **Is this site safe to use?** - yes; every feature here (local progress tracking, live
   game data, interactive maps) is the same kind of thing other common Tarkov companion sites
   already do, plus specifics: no account/login system, Progress Tracker data stays in the
   browser's local storage, live data is proxied from the community tarkov.dev API.
2. **Why was this site designed?** - acknowledges most individual features exist elsewhere, but
   this site has its own design/layout QoL choices, specifically calling out live map drawing as
   a real communication tool for SOG Sherpa Sessions' post-raid analysis.
3. **Do I need to create an account?** - no, explains the local-storage/manual-backup model.
4. **How current is the quest/item/price data?** - live from tarkov.dev, not a static snapshot.
5. **Found a bug or have a feature idea?** - points at the footer's `AboutLink` Discord contact
   rather than duplicating the Discord username here, so there's one place to update it.
6. **How can I support this site?** - no monetization/paywalls, ever; donations (a placeholder
   `#tip-jar-placeholder` link - needs a real URL before this goes live) go toward hosting costs.

Unlike the other `src/features/*` folders, this isn't a migration phase target - there's no legacy
equivalent in either `old/TarkovTrackerWB-main` or `old/tarkov-tips`. It's new content, same
category as `external-resources`.

**Status:** COMPLETE - implemented and live at `/faq`, linked from the header nav directly before
"Resources" (External Resources), per the user's explicit placement request. Covered by
`FAQItem.test.tsx` (toggle behavior) and `FAQPage.test.tsx` (ordering + content). The tip jar link
is a real placeholder (`href="#tip-jar-placeholder"`) - swap it for an actual donation URL before
treating this as launch-ready.
