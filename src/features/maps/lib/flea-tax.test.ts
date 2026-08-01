import { describe, expect, it } from "vitest";

import { fleaNet, fleaTax } from "./flea-tax";

describe("fleaTax", () => {
  it("returns 0 when base price or list price is missing", () => {
    expect(fleaTax(0, 45_000)).toBe(0);
    expect(fleaTax(40_000, 0)).toBe(0);
  });

  it("returns a positive tax for a realistic listing", () => {
    expect(fleaTax(40_000, 45_000)).toBeGreaterThan(0);
  });
});

describe("fleaNet", () => {
  it("is the list price minus a positive tax", () => {
    const net = fleaNet(40_000, 45_000);
    expect(net).toBeGreaterThan(0);
    expect(net).toBeLessThan(45_000);
  });

  it("floors at 0 when the tax exceeds the list price", () => {
    // A tiny base price against a high list price yields a huge tax.
    expect(fleaNet(100, 50_000)).toBe(0);
  });
});
