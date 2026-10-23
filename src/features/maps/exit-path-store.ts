import { create } from "zustand";

import type { Point } from "./lib/exit-path";

export interface ExitPathState {
  /** Show every exit of the map, not just the ones listed by the last snip. */
  showAllExits: boolean;
  /** "Go to Exit" is on: draw a path from the known position to the target exit. */
  pathOn: boolean;
  /** The exit last clicked as the target (`kind:id`), or `null` for "closest available". */
  selectedKey: string | null;
  /** The selection came from the exit keys, so its name is shown open. */
  keyOpened: boolean;
  /**
   * Test wiring, kept but with no button in the UI: clicking the map places a
   * stand-in position and the exits come from the map data, so the path can be
   * tried without a raid. Nothing turns it on today.
   */
  testMode: boolean;
  /** The stand-in position placed by clicking in test mode. */
  testPoint: Point | null;
  setShowAllExits: (on: boolean) => void;
  setPathOn: (on: boolean) => void;
  toggleSelected: (key: string) => void;
  /** Select an exit outright (the exit keys), where `toggleSelected` would deselect a repeat. */
  setSelected: (key: string) => void;
  clearSelection: () => void;
  setTestMode: (on: boolean) => void;
  setTestPoint: (point: Point | null) => void;
}

/**
 * Exit path controls. In-memory only, like the exit snip itself: a selected
 * exit or a tester point means nothing in the next raid or the next visit.
 */
export const useExitPathStore = create<ExitPathState>((set) => ({
  showAllExits: false,
  pathOn: false,
  selectedKey: null,
  keyOpened: false,
  testMode: false,
  testPoint: null,
  setShowAllExits(on) {
    set({ showAllExits: on });
  },
  setPathOn(on) {
    set({ pathOn: on });
  },
  toggleSelected(key) {
    set((state) => ({ selectedKey: state.selectedKey === key ? null : key, keyOpened: false }));
  },
  setSelected(key) {
    set({ selectedKey: key, keyOpened: true });
  },
  clearSelection() {
    set({ selectedKey: null, keyOpened: false });
  },
  setTestMode(on) {
    // Leaving the tester drops its point so a stale one can never be routed from.
    set(on ? { testMode: true } : { testMode: false, testPoint: null });
  },
  setTestPoint(point) {
    set({ testPoint: point });
  },
}));
