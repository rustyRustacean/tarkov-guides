import { beforeEach, describe, expect, it } from "vitest";

import { midpointAlong } from "./components/RulerLayer";
import { useRulerStore } from "./ruler-store";

describe("ruler store", () => {
  beforeEach(() => {
    useRulerStore.setState({ on: false, a: null, b: null });
  });

  it("places A, then B, then starts over from A", () => {
    useRulerStore.getState().setOn(true);
    useRulerStore.getState().place({ x: 1, z: 1 });
    expect(useRulerStore.getState().a).toEqual({ x: 1, z: 1 });
    useRulerStore.getState().place({ x: 2, z: 2 });
    expect(useRulerStore.getState().b).toEqual({ x: 2, z: 2 });
    useRulerStore.getState().place({ x: 3, z: 3 });
    expect(useRulerStore.getState().a).toEqual({ x: 3, z: 3 });
    expect(useRulerStore.getState().b).toBeNull();
  });

  it("forgets both points when turned off", () => {
    useRulerStore.getState().setOn(true);
    useRulerStore.getState().place({ x: 1, z: 1 });
    useRulerStore.getState().setOn(false);
    expect(useRulerStore.getState().a).toBeNull();
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
