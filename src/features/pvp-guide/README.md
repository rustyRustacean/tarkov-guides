# PvP Guide

A tiered (Essential → Intermediate → Advanced) PvP learning path: a "Quick Start" condensed
summary tab plus a "Full Guide" tab linking out to 6 in-depth tutorials. Ported entirely from
`old/tarkov-tips` - `old/TarkovTrackerWB-main` has no comparable content, per the user's explicit
instruction for this port.

**Self-contained, not dependent on a future Tutorials feature.** tarkov-tips's own guide links out
to a separate, multi-category tutorial catalog (`/tutorials/{slug}`) that this project hasn't built
yet. Rather than block on that or duplicate its scope, this feature owns its own MDX content and
compiler, with its own tutorial detail routes at `/pvp-guide/{slug}`. If a future Tutorials phase
happens, it's a separate effort.

## Ported from

- `old/tarkov-tips/src/data/{pvp-learning-path,pvp-condensed-guide}.ts` - tiered path + quick-start
  summary data → `lib/pvp-learning-path.ts` / `lib/pvp-condensed-guide.ts`.
- `old/tarkov-tips/src/lib/{pvp-learning-path,mdx,tutorials}.ts` - join/navigation logic and the MDX
  compile pipeline → `lib/pvp-learning-path.ts` / `lib/mdx.ts` / `lib/tutorial-content.ts`.
- `old/tarkov-tips/src/content/tutorials/{pvp1,pvp3,pvp4,pvp5,pvp8,pvp9}.mdx` - the 6 real,
  shipped-in-the-guide tutorials → `content/*.mdx`. Two more source files exist
  (`pvp10`/`pvp11` - map strategies, team coordination) but were never wired into the live guide;
  left out of this port to match what actually shipped, not the author's unfinished backlog.
- `old/tarkov-tips/src/components/pvp/*`, `src/components/tutorials/{AutoplayVideo,SkipToVideo}.tsx`
  - presentation, rewritten cleanly with this project's design system (`Card`/`Badge`/`Tabs`) rather
    than ported as-is.

## Real content bugs fixed during the port, not reproduced

1. **`pvp8`/`pvp9`'s condensed-guide summaries were stale placeholders** describing content that
   was never written under those slugs (`pvp6`/`pvp7` were skipped, and `pvp8`/`pvp9` ended up
   covering different topics than originally planned - confirmed via
   `old/tarkov-tips/_reference/pvp-tutorial-roadmap.md`). `lib/pvp-condensed-guide.ts` and
   `lib/pvp-learning-path.ts` carry rewritten summaries matching what the real articles cover
   (combat technique integration by engagement range; equipment/weight-class optimization).
2. **Every condensed-guide section reused the same one video** regardless of topic, and two other
   referenced clips were 0-byte stub files. Only `pvp1`'s article has a real, on-topic demo -
   `public/videos/pvp-guide/a-d-strafing-comparison.webm` is the one real asset ported, attached
   only to `pvp1`'s entry. The other 5 sections render with no video block rather than a mismatched
   one.
3. **`*[GIF PLACEHOLDER: ...]*` text markers** (17 across `pvp8`/`pvp9`) were dead stubs for art
   that was never produced - stripped during the port.
4. **`category` frontmatter dropped entirely**, not just corrected. The source mislabels 4 of its 6
   real files (`weapons`/`economy`/`maps`/`quests` instead of `pvp` - copy-paste errors); that field
   only mattered for filtering across tarkov-tips's multi-topic catalog, which this self-contained
   feature doesn't have. Every article here is definitionally PvP content, so the field had no
   purpose left to serve correctly.
5. **`getNextTutorialInPath`/`getPreviousTutorialInPath`/`getTutorialProgressInPath`** existed in
   the source but were never called from anywhere (dead code). `PvpTutorialPage` wires them up for
   real prev/next navigation and a progress bar on every tutorial page.

## Architecture

- **MDX pipeline**: `next-mdx-remote/rsc`'s `compileMDX` (`lib/mdx.ts`) + `gray-matter`/`reading-time`
  for frontmatter-only metadata reads (`lib/tutorial-content.ts`) that don't need a full compile.
  `content/*.mdx` files are feature-local (not a shared top-level `src/content/`). Both
  `lib/tutorial-content.ts` and `lib/mdx.ts` import the `server-only` package (a real first for this
  project - see `vitest.config.ts`'s `resolve.alias` for why that needed a small config addition to
  stay testable).
- **Routes**: `src/app/pvp-guide/page.tsx` (hub, thin wrapper around `PvpGuidePage`) and
  `src/app/pvp-guide/[slug]/page.tsx` (tutorial detail, `generateStaticParams` prerenders all 6 at
  build time, thin wrapper around `PvpTutorialPage`).
- **Prose styling**: `@tailwindcss/typography`'s `prose` class, re-pointed at this project's own
  design tokens in `globals.css` (`--tw-prose-*` → `--color-*`) rather than its default static gray
  palette, so compiled MDX content re-themes correctly across all 6 themes. Deliberately no
  `dark:prose-invert` - this project themes via `[data-theme]`, not Tailwind's separate dark-mode
  variant.
- No `store.ts`/`persistence/` - this feature has no user state to persist, it's pure content.

## Status

Implemented. `/pvp-guide` (hub, Quick Start + Full Guide tabs) and `/pvp-guide/{pvp1,pvp3,pvp4,pvp5,pvp8,pvp9}`
(tutorial detail pages with prev/next nav) are live, linked from the header nav and a real homepage
feature card.
