# Home

Homepage-only presentational feature - the hero animation and its supporting
hooks. Unlike the other `src/features/*` folders, this isn't a migration
phase target; it exists because the hero animation is mounted only in
`src/app/page.tsx` (not `layout.tsx`), so it doesn't qualify for
`src/shared/ui` under this project's colocation rule (see `CODING_STANDARDS.md`).

**Ported from:**

- `old/tarkov-tips/src/components/RiverEffect.tsx` - the canvas particle
  "river" animation, rewritten to read its colors from this project's theme
  tokens (`--accent`/`--accent2` in `src/app/globals.css`) instead of a
  hardcoded green/emerald palette, so it re-colors correctly under all 6
  themes. See `RiverHero.tsx`'s doc comment for the exact mechanism.
- `old/tarkov-tips/src/hooks/useMousePosition.ts` - ported near-verbatim as
  `use-mouse-position.ts`.

`use-prefers-reduced-motion.ts` has no legacy equivalent - neither legacy
site handled `prefers-reduced-motion`; this is a deliberate accessibility
addition (the animation renders one static frame instead of looping).

**Status:** COMPLETE - `RiverHero` is rendered in the homepage hero at `/`.
