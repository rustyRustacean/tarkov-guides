import { create } from "zustand";

interface SiteStatusBannerState {
  /** Whether the visitor has closed the site-wide "under active development" notice. */
  dismissed: boolean;
  dismiss: () => void;
  restoreDismissed: () => void;
}

const STORAGE_KEY = "tarkovguides.site-status-banner.dismissed.v1";

/**
 * Backs `SiteStatusBanner`'s dismiss state. Initialised to `false` (not read
 * from localStorage) so the client's first render matches the server's and
 * React doesn't report a hydration mismatch; the real stored value is
 * applied on mount via `restoreDismissed`, the same pattern as
 * `session-store.ts`'s `followHostView`.
 *
 * Persists across reloads (unlike `game-data-banner-store.ts`'s session-only
 * `dismissedAt`), because there's no "new occurrence" here to re-surface the
 * notice for. It's a static disclaimer, not an error condition, so once a
 * visitor closes it, nothing should bring it back.
 */
export const useSiteStatusBannerStore = create<SiteStatusBannerState>((set) => ({
  dismissed: false,
  dismiss() {
    set({ dismissed: true });
    writeDismissed(true);
  },
  restoreDismissed() {
    const stored = readDismissed();
    if (stored !== null) set({ dismissed: stored });
  },
}));

function readDismissed(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

function writeDismissed(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Private-mode / disabled storage: the dismissal just doesn't persist.
  }
}
