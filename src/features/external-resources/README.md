# External Resources

A curated list of external community sites and tools that don't (yet, or ever) belong on
TarkovGuides itself - a featured Discord community banner ("The SOG") above a card grid of
tools/trackers/guides (tarkov.dev tools, Arena maps, 3D maps, story guides, boss spawn tracker,
BTR tracker, Database for Tarkov, Seasonal Modifier Planner, Tarkov Changes) plus a multi-link
"Other Discords" card - EFT Wiki Discord's `#new-info-forum` channel and Sherpa Hub - which is
always last and spans 2 columns (`sm:col-span-2`) to absorb whatever remainder the regular card
count leaves against `lg:grid-cols-3`. Every card leaves the site via a plain
`<a target="_blank">`, not `TransitionLink`. Keep "Other Discords" last and re-check its span
whenever a card is added/removed - the goal is no dangling single-card row on desktop.

Unlike the other `src/features/*` folders, this isn't a migration phase target - there's no
legacy equivalent in either `old/TarkovTrackerWB-main` or `old/tarkov-tips`. It's new content,
curated directly rather than ported.

**Status:** COMPLETE - implemented and live at `/external-resources`, linked from the header nav
(as "Resources"). Not yet covered by any test (no `*.test.tsx` in this feature) - a gap worth
closing before this page's content changes often.
