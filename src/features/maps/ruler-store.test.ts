import { beforeEach, describe, expect, it } from "vitest";

import { midpointAlong } from "./components/RulerLayer";
import { rulerPointA, rulerPointB, useRulerStore } from "./ruler-store";

describe("ruler store", () => {
  beforeEach(() => {
    useRulerStore.setState({ on: false, a: null, b: null, map: null });
  });

  it("places A, then B, then starts over from A", () => {
    useRulerStore.getState().setOn(true);
    useRulerStore.getState().place({ x: 1, z: 1 }, "customs");
    expect(useRulerStore.getState().a).toEqual({ x: 1, z: 1 });
    useRulerStore.getState().place({ x: 2, z: 2 }, "customs");
    expect(useRulerStore.getState().b).toEqual({ x: 2, z: 2 });
    useRulerStore.getState().place({ x: 3, z: 3 }, "customs");
    expect(useRulerStore.getState().a).toEqual({ x: 3, z: 3 });
    expect(useRulerStore.getState().b).toBeNull();
  });

  it("forgets both points when turned off", () => {
    useRulerStore.getState().setOn(true);
    useRulerStore.getState().place({ x: 1, z: 1 }, "customs");
    useRulerStore.getState().setOn(false);
    expect(useRulerStore.getState().a).toBeNull();
  });

  it("shows the points only on the map they were placed on", () => {
    useRulerStore.getState().setOn(true);
    useRulerStore.getState().place({ x: 1, z: 1 }, "customs");
    useRulerStore.getState().place({ x: 2, z: 2 }, "customs");
    const state = useRulerStore.getState();
    expect(rulerPointA(state, "customs")).toEqual({ x: 1, z: 1 });
    expect(rulerPointB(state, "customs")).toEqual({ x: 2, z: 2 });
    expect(rulerPointA(state, "woods")).toBeNull();
    expect(rulerPointB(state, "woods")).toBeNull();
  });

  it("starts over from A when a point is placed on another map", () => {
    useRulerStore.getState().setOn(true);
    useRulerStore.getState().place({ x: 1, z: 1 }, "customs");
    useRulerStore.getState().place({ x: 5, z: 5 }, "woods");
    const state = useRulerStore.getState();
    expect(rulerPointA(state, "woods")).toEqual({ x: 5, z: 5 });
    expect(rulerPointB(state, "woods")).toBeNull();
    expect(rulerPointA(state, "customs")).toBeNull();
  });
});

describe("midpointAlong", () => {
  it("sits halfway by walked length, not by point count", () => {
    const mid = midpointAlong([
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 30 },
    ]);
    // Total 40, half is 20: 10 m east then 10 m along the second leg.
    expect(mid).toEqual({ x: 10, z: 10 });
  });

  it("returns null for no points", () => {
    expect(midpointAlong([])).toBeNull();
  });
});
