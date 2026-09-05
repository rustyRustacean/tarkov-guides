import { describe, expect, it } from "vitest";

import { sharedViewTarget } from "./session-view";

import type { SessionView } from "../session/liveblocks-config";

function view(overrides: Partial<SessionView> = {}): SessionView {
  return {
    mapNormalizedName: "customs",
    variantId: "overview",
    center: { lat: 10, lng: 20 },
    zoom: 4,
    ...overrides,
  };
}

describe("sharedViewTarget", () => {
  it("fits the controller's visible area when bounds are published", () => {
    const target = sharedViewTarget(
      view({ bounds: { north: 50, south: -50, east: 100, west: -100 } }),
    );
    // Leaflet order is [[south, west], [north, east]].
    expect(target).toEqual({
      kind: "bounds",
      bounds: [
        [-50, -100],
        [50, 100],
      ],
    });
  });

  it("ignores the controller's zoom level entirely when bounds exist", () => {
    // The point of the change: two screens applying the same zoom level see
    // different amounts of map, so zoom must not drive a follower's view.
    const target = sharedViewTarget(
      view({ zoom: 7, bounds: { north: 1, south: 0, east: 1, west: 0 } }),
    );
    expect(target.kind).toBe("bounds");
  });

  it("falls back to center+zoom for a participant on a build without bounds", () => {
    expect(sharedViewTarget(view())).toEqual({ kind: "center", center: [10, 20], zoom: 4 });
  });

  it("falls back when the rectangle has no area - nothing to fit", () => {
    expect(sharedViewTarget(view({ bounds: { north: 5, south: 5, east: 9, west: 1 } })).kind).toBe(
      "center",
    );
    expect(sharedViewTarget(view({ bounds: { north: 9, south: 1, east: 5, west: 5 } })).kind).toBe(
      "center",
    );
  });

  it("falls back on non-finite bounds rather than fitting to NaN", () => {
    expect(
      sharedViewTarget(view({ bounds: { north: Number.NaN, south: 0, east: 1, west: 0 } })).kind,
    ).toBe("center");
  });
});
