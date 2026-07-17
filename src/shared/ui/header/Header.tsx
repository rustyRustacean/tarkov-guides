import { ThemePicker } from "@/shared/ui/theme/ThemePicker";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

/**
 * Not-yet-built areas from both legacy sites, mirrored from the homepage's
 * feature grid (`src/app/page.tsx`) so the header advertises the same site
 * map. Kept as a plain local list rather than a shared constant - three
 * short labels duplicated in two places is simpler than an indirection for
 * data this small (see `CODING_STANDARDS.md` on avoiding premature
 * abstraction); update both spots together if this list changes.
 */
const COMING_SOON_NAV_ITEMS = ["Tutorials", "Ballistics", "Flea Market"];

/**
 * Site-wide header: wordmark, nav links, and the theme picker. The
 * wordmark always renders in Bender (`font-brand`) regardless of the
 * active theme, so brand identity stays constant across all 6 themes -
 * see `--font-brand` in `globals.css`.
 *
 * Nav links to real routes are added one at a time as each feature phase
 * lands (Progress Tracker, PvP Guide, Maps, External Resources so far). Per
 * the same
 * user-approved decision behind the homepage's "Coming Soon" feature grid
 * (`src/app/page.tsx`), every other not-yet-built area also gets an inert
 * marker here (plain `<span>`, no `href`, hidden below `md` to keep the
 * mobile header from overflowing) - this is a different UI treatment
 * (disabled marker vs. no mention) from a real hardcoded link, not a
 * contradiction of "don't link to routes that don't exist yet".
 */
export function Header() {
  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <TransitionLink
          href="/"
          className="font-brand text-foreground shrink-0 text-xl font-bold tracking-wide"
        >
          TarkovGuides
        </TransitionLink>

        <nav aria-label="Main" className="flex flex-1 items-center gap-4">
          <TransitionLink
            href="/progress-tracker"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Progress Tracker
          </TransitionLink>
          <TransitionLink
            href="/pvp-guide"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            PvP Guide
          </TransitionLink>
          <TransitionLink
            href="/maps"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Maps
          </TransitionLink>
          <TransitionLink
            href="/external-resources"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Resources
          </TransitionLink>

          <div className="hidden items-center gap-4 md:flex">
            {COMING_SOON_NAV_ITEMS.map((label) => (
              <span
                key={label}
                className="text-muted-foreground/50 flex items-center gap-1.5 text-sm font-medium"
              >
                {label}
                <span className="text-[10px] font-semibold tracking-wide uppercase">Soon</span>
              </span>
            ))}
          </div>
        </nav>

        <ThemePicker />
      </div>
    </header>
  );
}
