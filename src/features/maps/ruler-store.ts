import { create } from "zustand";

import type { Point } from "./lib/exit-path";

export interface RulerState {
  /** The ruler tool is on: map clicks place its two points. */
  on: boolean;
  a: Point | null;
  b: Point | null;
  /** The map tab the points were placed on: they are game coordinates of that map only. */
  map: string | null;
  setOn: (on: boolean) => void;
  /** First click sets A, second sets B, a third starts over from A. A click on another map starts over there. */
  place: (point: Point, map: string) => void;
  clear: () => void;
}

/**
 * The ruler's two points. In-memory only, like the exit path state: a measured
 * pair of spots means nothing after a reload or on another map. The on/off
 * switch is global, so the points carry the map they belong to, and every
 * reader goes through `rulerPointsFor` to see them only on that map.
 */
export const useRulerStore = create<RulerState>((set) => ({
  on: false,
  a: null,
  b: null,
  map: null,
  setOn(on) {
    set(on ? { on: true } : { on: false, a: null, b: null, map: null });
  },
  place(point, map) {
    set((state) =>
      state.map !== map || state.a === null || state.b !== null
        ? { a: point, b: null, map }
        : { b: point },
    );
  },
  clear() {
    set({ a: null, b: null, map: null });
  },
}));

/** The ruler's A point as seen on `map`: `null` when the points were placed on another map. */
export function rulerPointA(state: RulerState, map: string): Point | null {
  return state.map === map ? state.a : null;
}

/** The ruler's B point as seen on `map`: `null` when the points were placed on another map. */
export function rulerPointB(state: RulerState, map: string): Point | null {
  return state.map === map ? state.b : null;
}
