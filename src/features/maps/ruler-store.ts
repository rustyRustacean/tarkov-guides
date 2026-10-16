import { create } from "zustand";

import type { Point } from "./lib/exit-path";

export interface RulerState {
  /** The ruler tool is on: map clicks place its two points. */
  on: boolean;
  a: Point | null;
  b: Point | null;
  setOn: (on: boolean) => void;
  /** First click sets A, second sets B, a third starts over from A. */
  place: (point: Point) => void;
  clear: () => void;
}

/**
 * The ruler's two points. In-memory only, like the exit path state: a measured
 * pair of spots means nothing after a reload or on another map.
 */
export const useRulerStore = create<RulerState>((set) => ({
  on: false,
  a: null,
  b: null,
  setOn(on) {
    set(on ? { on: true } : { on: false, a: null, b: null });
  },
  place(point) {
    set((state) => (state.a === null || state.b !== null ? { a: point, b: null } : { b: point }));
  },
  clear() {
    set({ a: null, b: null });
  },
}));
