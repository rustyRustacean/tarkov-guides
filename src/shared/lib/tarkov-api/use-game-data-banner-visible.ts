"use client";

import { useGameDataBannerStore } from "./game-data-banner-store";
import { useTarkovGameData } from "./use-tarkov-game-data";

/**
 * Single source of truth for "is `GameDataStatusBanner` currently on
 * screen", shared between the banner itself and `MapsPage.tsx` (which needs
 * to know whether to subtract the banner's height from its own
 * `calc(100vh-…)` viewport math, see its doc comment). Keeping this as one
 * hook, rather than each caller re-deriving `isError && errorUpdatedAt >
 * dismissedAt` itself, is what guarantees the two never disagree: e.g. the
 * banner considering itself dismissed while `MapsPage` still reserves space
 * for it, leaving a gap.
 */
export function useGameDataBannerVisible(): boolean {
  const { isError, errorUpdatedAt } = useTarkovGameData();
  const dismissedAt = useGameDataBannerStore((state) => state.dismissedAt);
  return isError && errorUpdatedAt > dismissedAt;
}
