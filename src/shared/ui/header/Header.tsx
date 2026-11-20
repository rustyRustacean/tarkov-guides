import { ThemePicker } from "@/shared/ui/theme/ThemePicker";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { HelpLink } from "./HelpLink";

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
  /** Rendered before the help button. Currently `CompanionButton` (`features/companion`). */
  beforeHelp?: ReactNode;
  /**
   * The site-wide game mode control, currently `ModeSwitcher`
   * (`features/progress-tracker`). Its own slot rather than part of
   * `afterHelp` because it moves to the second row on narrow screens, where
   * it must always be fully visible.
   */
  modeSwitcher?: ReactNode;
  /** Rendered after the mode switcher, before the theme picker. Currently `ProfileSwitcher` (`features/progress-tracker`). */
  afterHelp?: ReactNode;
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
 *
 * Layout: one row from `xl` up (wordmark, nav, companion and help, mode,
 * profile and theme). Below `xl` that row needs about 1140px and doesn't
 * fit, so it becomes two rows: the wordmark and the corner controls on top,
 * then the mode switcher and the nav links underneath. The mode switcher
 * leads the second row because it sets the mode for the whole site and must
 * always be fully visible; the nav scrolls sideways when its links don't fit.
 * Placement is CSS grid only, so the DOM (and keyboard) order is the same at
 * every width. The height comes from `--header-height` (`globals.css`), which
 * layouts that offset themselves against the header read as well.
 */
export function Header({ beforeHelp, modeSwitcher, afterHelp }: HeaderProps) {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto grid h-(--header-height) max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] content-center items-center gap-x-2 gap-y-1 px-4 sm:gap-x-3 xl:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]">
        <TransitionLink
          href="/"
          className="font-brand text-foreground col-start-1 row-start-1 text-lg font-bold tracking-wide whitespace-nowrap sm:text-xl xl:mr-1"
        >
          TarkovGuides
        </TransitionLink>

        <nav
          aria-label="Main"
          className="col-span-2 col-start-2 row-start-2 flex min-w-0 scrollbar-none items-center gap-1 overflow-x-auto xl:col-span-1 xl:col-start-2 xl:row-start-1"
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

        {/* Corner controls, site-wide: the EFT companion button, then the
            help button, then the game-mode switcher and the active-profile
            switcher, and the theme picker at the far right end. The
            companion button and the switchers are passed in by `layout.tsx`
            (see {@link HeaderProps}); the help button and theme picker are
            owned directly by this shared component. The mode/profile
            switchers read the app-wide progress store (hydrated in
            `providers.tsx`), so they work on every route. Below `xl` the
            mode switcher drops to the start of the second row (see the doc
            comment above); the other two groups stay top right. */}
        <div className="col-start-2 row-start-1 flex items-center gap-2 justify-self-end sm:gap-3 xl:col-start-3 xl:justify-self-auto">
          {beforeHelp}
          <HelpLink />
        </div>
        <div className="col-start-1 row-start-2 flex items-center xl:col-start-4 xl:row-start-1">
          {modeSwitcher}
        </div>
        <div className="col-start-3 row-start-1 flex items-center gap-2 sm:gap-3 xl:col-start-5">
          {afterHelp}
          <ThemePicker />
        </div>
      </div>
    </header>
  );
}
