# Shared UI

Design-system primitives used across every feature. **Status: implemented (Phase 2, complete).** See migration plan Phase 2 for the full design rationale; this file is the quick-reference for what actually landed.

## File map

```
src/shared/ui/
  lib/cn.ts                          clsx + tailwind-merge class-name helper
  button/Button.tsx                  cva variants; @radix-ui/react-slot for asChild
  card/Card.tsx                      Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
  badge/Badge.tsx                    cva variants incl. status-* game-domain colors
  progress/Progress.tsx              Radix Progress
  dialog/Dialog.tsx                  Radix Dialog - replaces legacy's unescaped-innerHTML modals
  tabs/Tabs.tsx                      Radix Tabs
  tooltip/Tooltip.tsx                Radix Tooltip (TooltipProvider mounted once in src/app/providers.tsx)
  toast/
    toast-store.ts                   Zustand - imperative toast({message, action?, durationMs?})
    Toast.tsx                        Toaster component (mounted once in src/app/providers.tsx)
  theme/
    theme-config.ts                  ThemeMeta[], ThemeId type, THEME_STORAGE_KEY, isThemeId()
    ThemeProvider.tsx                useSyncExternalStore against the data-theme DOM attribute
    use-theme.ts                     useTheme() hook
    ThemePicker.tsx                  Radix DropdownMenuRadioGroup theme switcher
  transition-link/
    TransitionLink.tsx               next/link wrapper using the View Transitions API when supported
    use-view-transition.ts
    use-view-transitions-support.ts
  header/Header.tsx                  wordmark (Bender/font-brand) + nav (grows per landed feature) + ThemePicker
  footer/
    Footer.tsx                        tagline + unaffiliation disclaimer + Credits link + ContactLink
    ContactLink.tsx                   footer-only "Contact us" link - click toggles an email/Discord-contact speech bubble
```

Every file above has a colocated `*.test.ts(x)`. `src/app/fonts.ts`, `src/app/theme-init-script.ts`, and `src/app/globals.css` (the token architecture itself) are the other Phase 2 pieces - they live in `src/app/` rather than here since they're app-shell wiring, not reusable UI components; see `ARCHITECTURE.md`'s "Design token architecture" section for the full explanation.

## Theme system reference

4 selectable themes, one picker, `inventory` is the default:

| id          | name              | notes                                                                                                                                                      |
| ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory` | Inventory Grid    | Default. Subtle grid-line background; shares Modern's 8px/4px card-radius tokens rather than the other legacy themes' sharper corners.                     |
| `modern`    | Modern            | Former default. Fixed navy-blue gradient + green accent, ported from old/tarkov-tips's actual default look (its own `ThemeProvider` started in dark mode). |
| `midnight`  | Midnight          | Auto-follows system light/dark - no separate light/dark toggle.                                                                                            |
| `terminal`  | Tactical Terminal | Phosphor green CRT + scanline overlay.                                                                                                                     |

**`warm-gold` (Warm Gold) and `briefing` (Mission Briefing) are disabled (2026-07-18, per user
request)** - commented out, not deleted, in `theme-config.ts` (`THEMES`, `ThemeId`, `THEME_IDS`)
and their `[data-theme="…"]` token blocks in `src/app/globals.css`, so both can be restored later
without re-deriving the palettes. `isThemeId`/`THEME_IDS` no longer accept either id, so a browser
with one still saved in `localStorage` from before this change falls back to `DEFAULT_THEME_ID`
rather than applying it.

- localStorage key: `tarkovguides.theme.v1` (new key - never reused legacy TarkovTrackerWB-main's `odqum.theme.v1`, different site/namespace).
- Mechanism: `data-theme` attribute on `<html>`, always one of the 4 ids above (never absent). Set pre-paint by the blocking script in `src/app/theme-init-script.ts` to avoid a flash of the wrong theme.
- All literal color values live in `src/app/globals.css`'s Layer 1 (`[data-theme="…"]` blocks) - this file doesn't duplicate them.

## Legacy reference material (for provenance - do not lift-and-shift; already ported/rewritten)

- `old/TarkovTrackerWB-main/src/app/globals.css` - source of the 4 legacy themes' literal color tokens.
- `old/TarkovTrackerWB-main/src/lib/theme.js` - source of the 4 legacy themes' id/name/description/swatch metadata.
- `old/TarkovTrackerWB-main/src/lib/toast.js` - source of the toast timing behavior (2500ms plain / 6000ms with an action button, single-pending-toast) ported into `toast-store.ts`.
- `old/tarkov-tips/src/providers/ThemeProvider.tsx` - reference for what **not** to do: hardcoded initial theme state with a post-mount correction causes a real flash-of-wrong-theme; fixed here via `useSyncExternalStore` + a pre-hydration blocking script instead.
- `old/tarkov-tips/src/components/layout/{Header,Footer}.tsx`, `src/components/ui/TransitionLink.tsx`, `src/hooks/{useViewTransition,useViewTransitionsSupport}.ts` - starting points, rewritten clean (dropped hardcoded links to not-yet-existing routes, a leftover debug `console.log`, and the `isLoaded`-gated blank-div band-aid).

## Typography

- **Bender** (`--font-brand`, always active regardless of theme - used for the Header wordmark and as `inventory`, `modern`, and `midnight`'s display font): SIL Open Font License 1.1, unmodified, files at `src/app/fonts/bender/` alongside the verbatim `OFL.txt`. Copyright (c) 2009, Oleg Zhuravlev, Gladkikh Ivan (jovanny.ru).
- **Plus Jakarta Sans** (`modern` and `midnight`'s body font): loaded via `next/font/google` (OFL, no self-hosting/license bookkeeping needed). Replaces Wotfard, which was free for personal use only and not commercially licensed.
- The 4 legacy themes' fonts (Rajdhani, Lora, Cormorant Garamond, JetBrains Mono, Bebas Neue, Anton, Special Elite, Stardos Stencil, Crimson Pro) load via `next/font/google`. Three fonts referenced in legacy font-stack fallbacks but never actually loaded upstream (Share Tech Mono, Oswald, Courier Prime) were dropped rather than carried forward as dead weight.
