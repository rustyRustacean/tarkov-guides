"use client";

import { Construction, X } from "lucide-react";
import { useEffect } from "react";

import { useSiteStatusBannerStore } from "./site-status-banner-store";

/**
 * Site-wide "under active development" notice, mounted once in the root
 * layout (`app/layout.tsx`) directly below `Header` so every route gets it
 * without each page having to remember to render it. Same approach
 * `GameDataStatusBanner` uses for the (separate, error-driven) tarkov.dev
 * outage notice. Unlike that banner, this one isn't tied to any live
 * condition: a real slice of the site's shipped features are still
 * incomplete, buggy, or carry placeholder content (see `HANDOFF.md`'s
 * current-state section), and there's no programmatic signal for that, so
 * it always shows until a visitor dismisses it, rather than reacting to a
 * query state the way the game-data banner does.
 *
 * `restoreDismissed()` is called on mount (not read eagerly at store
 * creation) so the server-rendered and pre-hydration client output always
 * match; see `site-status-banner-store.ts`'s doc comment.
 *
 * Fixed `h-9` height (matches `GameDataStatusBanner`) is load-bearing, not
 * cosmetic: `MapsPage.tsx`'s viewport calc subtracts this exact value per
 * visible banner.
 */
export function SiteStatusBanner() {
  const dismissed = useSiteStatusBannerStore((state) => state.dismissed);
  const dismiss = useSiteStatusBannerStore((state) => state.dismiss);
  const restoreDismissed = useSiteStatusBannerStore((state) => state.restoreDismissed);

  useEffect(() => {
    restoreDismissed();
  }, [restoreDismissed]);

  if (dismissed) return null;

  return (
    <div
      role="status"
      className="bg-status-amber-soft text-status-amber flex h-9 shrink-0 items-center justify-center gap-2 px-3 text-xs sm:text-sm"
    >
      <Construction className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        TarkovGuides is under active development - some features are incomplete, may have bugs, or
        show placeholder content.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
