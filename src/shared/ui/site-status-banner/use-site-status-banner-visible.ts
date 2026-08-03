"use client";

import { useSiteStatusBannerStore } from "./site-status-banner-store";

/**
 * Single source of truth for "is `SiteStatusBanner` currently on screen",
 * shared between the banner itself and `MapsPage.tsx` (which needs to know
 * whether to subtract the banner's height from its own `calc(100vh-…)`
 * viewport math - see its doc comment). Mirrors
 * `use-game-data-banner-visible.ts`'s role for the other top-of-page banner.
 */
export function useSiteStatusBannerVisible(): boolean {
  return !useSiteStatusBannerStore((state) => state.dismissed);
}
