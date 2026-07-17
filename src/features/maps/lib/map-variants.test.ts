import { describe, expect, it } from "vitest";

import { getMergedVariants } from "./map-variants";

import type { CustomMapEntry } from "../types";
import type { MapVariant } from "./map-config";

function baseVariant(overrides: Partial<MapVariant> = {}): MapVariant {
  return { id: "overview", label: "Overview", imageUrl: "/maps/svg/Reserve.svg", ...overrides };
}

function customEntry(overrides: Partial<CustomMapEntry> = {}): CustomMapEntry {
  return { id: "custom-1", label: "My callouts", custom: true, ...overrides };
}

describe("getMergedVariants", () => {
  it("returns just the base variants when there are no custom entries", () => {
    const base = [baseVariant()];
    expect(getMergedVariants(base, [], {})).toEqual(base);
  });

  it("appends a custom variant whose image has resolved into the cache", () => {
    const base = [baseVariant()];
    const custom = [customEntry({ id: "custom-1", label: "My callouts" })];
    const cache = { "custom-1": "data:image/png;base64,AAAA" };

    const result = getMergedVariants(base, custom, cache);

    expect(result).toEqual([
      baseVariant(),
      {
        id: "custom-1",
        label: "My callouts",
        imageUrl: "data:image/png;base64,AAAA",
        custom: true,
      },
    ]);
  });

  it("marks a resolved custom variant with custom: true", () => {
    const custom = [customEntry({ id: "custom-1" })];
    const cache = { "custom-1": "data:image/png;base64,AAAA" };
    const result = getMergedVariants([], custom, cache);
    expect(result[0]?.custom).toBe(true);
  });

  it("never sets custom on a base variant", () => {
    expect(getMergedVariants([baseVariant()], [], {})[0]?.custom).toBeUndefined();
  });

  it("omits a custom entry whose image hasn't resolved into the cache yet", () => {
    const custom = [customEntry({ id: "custom-1" })];
    expect(getMergedVariants([baseVariant()], custom, {})).toEqual([baseVariant()]);
  });

  it("preserves order: base variants first, then resolved custom ones", () => {
    const base = [baseVariant({ id: "overview" }), baseVariant({ id: "2d", label: "2D" })];
    const custom = [customEntry({ id: "custom-1", label: "Custom A" })];
    const cache = { "custom-1": "data:image/png;base64,AAAA" };

    const result = getMergedVariants(base, custom, cache);

    expect(result.map((v) => v.id)).toEqual(["overview", "2d", "custom-1"]);
  });

  it("resolved custom variants never set the interactive flag", () => {
    const custom = [customEntry({ id: "custom-1" })];
    const cache = { "custom-1": "data:image/png;base64,AAAA" };
    const result = getMergedVariants([], custom, cache);
    expect(result[0]?.interactive).toBeUndefined();
  });
});
