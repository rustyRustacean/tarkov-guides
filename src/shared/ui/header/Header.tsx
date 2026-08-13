import { ThemePicker } from "@/shared/ui/theme/ThemePicker";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import type { ReactNode } from "react";

/**
 * Not-yet-built areas from both legacy sites, mirrored from the homepage's
 * feature grid (`src/app/page.tsx`) so the header advertises the same site
 * map. Kept as a plain local list rather than a shared constant: three
 * short labels duplicated in two places is simpler than an indirection for
 * data this small (see docs-site/content/docs/conventions.mdx on avoiding
 * premature abstraction); update both spots together if this list changes.
 *
 * Disabled per user request, commented out below along with the nav
 * markers that render it, rather than deleted, so it can be restored later
 * without re-deriving the list (same convention as the disabled
 * `warm-gold`/`briefing` themes in `theme-config.ts`).
 */
// const COMING_SOON_NAV_ITEMS = ["Quick Tips", "Ballistics", "Flea Market"];

/**
 * {@link Header}'s two corner-control slots, composed at the app layer
 * (`src/app/layout.tsx`) rather than imported directly by this component:
 * `shared/ui` doesn't take a dependency on any feature, the same layering
 * rule `DetailDialogs.tsx`'s own doc comment explains and follows.
 */
export interface HeaderProps {
  /** Rendered before the theme picker. Currently `CompanionButton` (`features/companion`). */
  beforeThemePicker?: ReactNode;
  /** Rendered after the theme picker. Currently `ProfileSwitcher` (`features/progress-tracker`). */
  afterThemePicker?: ReactNode;
}

/**
 * Site-wide header: wordmark, nav links, and the theme picker. The
 * wordmark always renders in Bender (`font-brand`) regardless of the
 * active theme, so brand identity stays constant across all 6 themes; see
 * `--font-brand` in `globals.css`.
 *
 * Nav links point at real routes only, added as each feature lands.
 * Display order is PvP Guide, Maps, Progress Tracker, FAQ, External
 * Resources (per the user's request), independent of the order features
 * originally landed in and no longer matching the homepage's feature-grid
 * order (`src/app/page.tsx`), which still leads with Progress Tracker.
 *
 * Not-yet-built areas used to also get an inert marker here (plain
 * `<span>`, no `href`), a different UI treatment from a real hardcoded
 * link, not a contradiction of "don't link to routes that don't exist
 * yet". Disabled per user request; see `COMING_SOON_NAV_ITEMS`' doc
 * comment above for why it's commented out rather than removed.
 */
export function Header({ beforeThemePicker, afterThemePicker }: HeaderProps) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <TransitionLink
          href="/"
          className="font-brand text-foreground shrink-0 text-xl font-bold tracking-wide"
        >
          TarkovGuides
        </TransitionLink>

        <nav
          aria-label="Main"
          className="flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto"
        >
          <TransitionLink
            href="/pvp-guide"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
          >
            PvP Guide
          </TransitionLink>
          <TransitionLink
            href="/maps"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
          >
            Maps
          </TransitionLink>
          <TransitionLink
            href="/progress-tracker"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
          >
            Progress Tracker
          </TransitionLink>
          <TransitionLink
            href="/faq"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
          >
            FAQ
          </TransitionLink>
          <TransitionLink
            href="/external-resources"
            className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors"
          >
            Resources
          </TransitionLink>

          {/* Disabled per user request, see
              COMING_SOON_NAV_ITEMS' doc comment above.
          <div className="hidden items-center gap-1 md:flex">
            {COMING_SOON_NAV_ITEMS.map((label) => (
              <span
                key={label}
                className="text-muted-foreground/50 flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap"
              >
                {label}
                <span className="text-[10px] font-semibold tracking-wide uppercase">Soon</span>
              </span>
            ))}
          </div>
          */}
        </nav>

        {/* Top-right corner controls, site-wide: the EFT companion button,
            then the theme picker, then the game-mode switcher and the
            active-profile switcher (small gaps, not crowded). The first
            and last are passed in by `layout.tsx` (see {@link HeaderProps}),
            only the theme picker is owned directly by this shared
            component. The mode/profile switchers read the app-wide
            progress store (hydrated in `providers.tsx`), so they work on
            every route.

            `min-w-0 shrink` + `overflow-x-auto` (not `shrink-0`) mirrors
            `nav`'s own overflow handling above: needed once this cluster's
            natural width could push past a narrow viewport's edge with no
            way to reach it. Each slot below gets its own `shrink-0`
            wrapper so the container scrolls horizontally instead of
            squishing any individual control, same as how nav's own links
            each carry `shrink-0` rather than the `<nav>` itself. */}
        <div className="flex min-w-0 shrink scrollbar-none items-center gap-3 overflow-x-auto">
          <div className="shrink-0">{beforeThemePicker}</div>
          <div className="shrink-0">
            <ThemePicker />
          </div>
          <div className="flex shrink-0 items-center gap-3">{afterThemePicker}</div>
        </div>
      </div>
    </header>
  );
}
