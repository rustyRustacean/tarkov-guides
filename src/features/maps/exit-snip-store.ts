import { create } from "zustand";

import type { AppliedExit, ExitSide } from "./lib/exit-snip";

/** The exits a snip put on the map, and the raid map they belong to. */
export interface AppliedExitSnip {
  /** The game's own location id for the raid this was read in (e.g. `"Shoreline"`). */
  nameId: string;
  side: ExitSide | "unknown";
  exits: readonly AppliedExit[];
  appliedAt: number;
}

export interface ExitSnipState {
  snip: AppliedExitSnip | null;
  apply: (snip: AppliedExitSnip) => void;
  clear: () => void;
}

/**
 * Exits read from the in-raid exit list (O) snip.
 *
 * Plain in-memory on purpose, like `useSoloTaskStore`: which extracts are
 * active, and which are `???`, is true for ONE raid only. Persisting it would
 * show last raid's exits on this raid's map, which is exactly the wrong thing
 * to be confidently drawn. It is cleared when the next raid starts (see
 * `useSnipWatcher`) and on a page reload.
 */
export const useExitSnipStore = create<ExitSnipState>((set) => ({
  snip: null,
  apply(snip) {
    set({ snip });
  },
  clear() {
    set({ snip: null });
  },
}));
