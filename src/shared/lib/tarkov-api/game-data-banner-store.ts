import { create } from "zustand";

interface GameDataBannerStoreState {
  /** Epoch ms of the last manual dismiss, or `0` if never dismissed. */
  dismissedAt: number;
  dismiss: () => void;
}

/**
 * Tracks whether the user has manually closed `GameDataStatusBanner`
 * (`shared/ui/game-data-banner/GameDataStatusBanner.tsx`). A standalone
 * store (mirrors `toast-store.ts`'s pattern) rather than local component
 * state because `MapsPage.tsx` also needs this exact "is the banner
 * currently showing" answer to size itself around the banner's real height
 * (see its own doc comment). A bare `dismissedAt` timestamp, not a boolean,
 * so a *new* fetch failure (`useTarkovGameData()`'s `errorUpdatedAt` ticking
 * forward past this value) automatically un-dismisses it: closing the
 * banner shouldn't silently suppress every future outage for the rest of
 * the session.
 */
export const useGameDataBannerStore = create<GameDataBannerStoreState>((set) => ({
  dismissedAt: 0,
  dismiss: () => {
    set({ dismissedAt: Date.now() });
  },
}));
