import { describe, expect, it } from "vitest";

import { MAP_CONFIGS, MAP_NORMALIZED_NAMES, getMapConfig } from "./map-config";

describe("MAP_CONFIGS", () => {
  it("has an entry for every name in MAP_NORMALIZED_NAMES, and no extras", () => {
    expect(Object.keys(MAP_CONFIGS).sort()).toEqual([...MAP_NORMALIZED_NAMES].sort());
  });

  it.each(MAP_NORMALIZED_NAMES)("%s has at least one variant", (normalizedName) => {
    const config = MAP_CONFIGS[normalizedName];
    expect(config?.variants.length).toBeGreaterThan(0);
  });

  it.each(MAP_NORMALIZED_NAMES)(
    "%s has at most one variant marked interactive",
    (normalizedName) => {
      const config = MAP_CONFIGS[normalizedName];
      const interactiveCount = config?.variants.filter((v) => v.interactive === true).length ?? 0;
      expect(interactiveCount).toBeLessThanOrEqual(1);
    },
  );

  it.each(MAP_NORMALIZED_NAMES)(
    "%s has well-formed bounds (two distinct corners)",
    (normalizedName) => {
      const config = MAP_CONFIGS[normalizedName];
      expect(config?.bounds).toHaveLength(2);
      expect(config?.bounds[0]).not.toEqual(config?.bounds[1]);
    },
  );

  it.each(MAP_NORMALIZED_NAMES)("%s has a well-formed 4-tuple transform", (normalizedName) => {
    const config = MAP_CONFIGS[normalizedName];
    expect(config?.transform).toHaveLength(4);
  });

  it("every map without a tileUrl has its interactive variant backed by a real imageUrl", () => {
    for (const normalizedName of MAP_NORMALIZED_NAMES) {
      const config = MAP_CONFIGS[normalizedName];
      if (config?.tileUrl) continue;
      const interactiveVariant = config?.variants.find((v) => v.interactive);
      if (interactiveVariant) {
        expect(interactiveVariant.imageUrl).toBeTruthy();
      }
    }
  });

  it("maps with a tileUrl point at the tarkov.dev CDN or a bundled local pyramid", () => {
    for (const normalizedName of MAP_NORMALIZED_NAMES) {
      const tileUrl = MAP_CONFIGS[normalizedName]?.tileUrl;
      if (tileUrl) {
        // Ice Breaker's pyramid is bundled under public/ (its tiles are the
        // map's default Overview, so it must not need the CDN); the rest
        // stream their optional Satellite View from assets.tarkov.dev.
        expect(tileUrl).toMatch(/^(https:\/\/assets\.tarkov\.dev\/maps\/|\/maps\/tiles\/)/);
      }
    }
  });
});

describe("getMapConfig", () => {
  it("resolves a real map by normalizedName", () => {
    expect(getMapConfig("ground-zero")?.name).toBe("Ground Zero");
  });

  it("returns undefined for an unknown map id", () => {
    expect(getMapConfig("not-a-real-map")).toBeUndefined();
  });
});
