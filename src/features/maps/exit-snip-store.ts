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
  /**
   * Put back the snip this tab applied before a reload, but only when it was
   * read in the raid being played now (`raidLocation`). Anything else is
   * dropped: last raid's exits must never be drawn on this raid's map.
   */
  restoreFor: (raidLocation: string | null) => void;
}

const STORAGE_KEY = "tg.exitsnip.session";
/** A raid is well under this; older than it can only be a previous raid's. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

function saveSnip(snip: AppliedExitSnip | null): void {
  try {
    if (snip === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snip));
  } catch {
    // Storage blocked: the snip simply won't survive a reload.
  }
}

function loadSnip(): AppliedExitSnip | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<AppliedExitSnip> | null;
    if (
      parsed === null ||
      typeof parsed.nameId !== "string" ||
      typeof parsed.appliedAt !== "number" ||
      !Array.isArray(parsed.exits)
    ) {
      return null;
    }
    return parsed as AppliedExitSnip;
  } catch {
    return null;
  }
}

/**
 * Exits read from the in-raid exit list (O) snip.
 *
 * Plain in-memory on purpose, like `useSoloTaskStore`: which extracts are
 * active, and which are `???`, is true for ONE raid only. Persisting it would
 * show last raid's exits on this raid's map, which is exactly the wrong thing
 * to be confidently drawn. It is cleared when the next raid starts (see
 * `useSnipWatcher`). A reload keeps it only for the same raid, via
 * `restoreFor`.
 */
export const useExitSnipStore = create<ExitSnipState>((set) => ({
  snip: null,
  apply(snip) {
    saveSnip(snip);
    set({ snip });
  },
  clear() {
    saveSnip(null);
    set({ snip: null });
  },
  restoreFor(raidLocation) {
    const saved = loadSnip();
    if (saved === null || raidLocation === null) return;
    const sameRaid = saved.nameId.toLowerCase() === raidLocation.toLowerCase();
    if (!sameRaid || Date.now() - saved.appliedAt > MAX_AGE_MS) {
      saveSnip(null);
      return;
    }
    set((state) => (state.snip === null ? { snip: saved } : state));
  },
}));
