import { describe, expect, it } from "vitest";

import {
  BASE_PRICE_TAX_RATE,
  calculateFleaNet,
  calculateFleaTax,
  LIST_PRICE_TAX_RATE,
  PRICE_RATIO_BASE,
  PRICE_RATIO_EXPONENT,
} from "./flea-tax";

/** Independently re-derives the documented formula, so a copy-paste bug can't hide behind a matching hardcoded expectation. */
function referenceFleaTax(basePrice: number, listPrice: number, count: number): number {
  const quantity = Math.max(1, count);
  let priceOffset = Math.log10(basePrice / listPrice);
  let priceRequirement = Math.log10(listPrice / basePrice);
  if (listPrice >= basePrice) {
    priceRequirement = Math.pow(priceRequirement, PRICE_RATIO_EXPONENT);
  } else {
    priceOffset = Math.pow(priceOffset, PRICE_RATIO_EXPONENT);
  }
  return Math.round(
    basePrice * BASE_PRICE_TAX_RATE * Math.pow(PRICE_RATIO_BASE, priceOffset) * quantity +
      listPrice * LIST_PRICE_TAX_RATE * Math.pow(PRICE_RATIO_BASE, priceRequirement) * quantity,
  );
}

describe("calculateFleaTax", () => {
  it("returns 0 when basePrice is zero/falsy", () => {
    expect(calculateFleaTax(0, 1000)).toBe(0);
  });

  it("returns 0 when listPrice is zero/falsy", () => {
    expect(calculateFleaTax(1000, 0)).toBe(0);
  });

  it("is exactly 10% flat at the equal-price boundary (self-verifying anchor)", () => {
    expect(calculateFleaTax(1000, 1000)).toBe(100);
  });

  it("treats an omitted count as 1", () => {
    expect(calculateFleaTax(1000, 1000)).toBe(calculateFleaTax(1000, 1000, 1));
  });

  it("floors a zero count to 1", () => {
    expect(calculateFleaTax(1000, 1000, 0)).toBe(calculateFleaTax(1000, 1000, 1));
  });

  it("floors a negative count to 1", () => {
    expect(calculateFleaTax(1000, 1000, -5)).toBe(calculateFleaTax(1000, 1000, 1));
  });

  it("matches an independently re-derived formula when listPrice > basePrice", () => {
    expect(calculateFleaTax(1000, 2000, 1)).toBe(referenceFleaTax(1000, 2000, 1));
    expect(calculateFleaTax(1000, 2000, 1)).toBe(179);
  });

  it("matches an independently re-derived formula when basePrice > listPrice", () => {
    expect(calculateFleaTax(2000, 1000, 1)).toBe(referenceFleaTax(2000, 1000, 1));
    expect(calculateFleaTax(2000, 1000, 1)).toBe(179);
  });

  it("never produces NaN for an extreme listPrice >> basePrice ratio", () => {
    const result = calculateFleaTax(100, 100_000, 1);
    expect(Number.isNaN(result)).toBe(false);
  });

  it("never produces NaN for an extreme basePrice >> listPrice ratio", () => {
    const result = calculateFleaTax(1_000_000, 1, 1);
    expect(Number.isNaN(result)).toBe(false);
  });

  it("scales roughly linearly with count", () => {
    expect(calculateFleaTax(1000, 1000, 5)).toBe(calculateFleaTax(1000, 1000, 1) * 5);
  });
});

describe("calculateFleaNet", () => {
  it("clamps to 0 for a falsy basePrice", () => {
    expect(calculateFleaNet(0, 1000)).toBe(1000);
  });

  it("subtracts the tax from the list price", () => {
    expect(calculateFleaNet(1000, 1000)).toBe(900);
  });

  it("clamps to 0 under extreme underpricing (tax exceeds proceeds)", () => {
    expect(calculateFleaNet(1_000_000, 1, 1)).toBe(0);
  });

  it("is consistent with calculateFleaTax's count=1 floor for a negative count", () => {
    // Regression test for the legacy count-flooring inconsistency: fleaTax
    // floored count to 1 but fleaNet's gross-proceeds line didn't, so a
    // negative count produced tax computed as count=1 but gross computed
    // as a negative number. This port floors count consistently in both.
    expect(calculateFleaNet(1000, 1000, -5)).toBe(calculateFleaNet(1000, 1000, 1));
    expect(calculateFleaNet(1000, 1000, -5)).toBe(900);
  });

  it("treats a zero count as 1", () => {
    expect(calculateFleaNet(1000, 1000, 0)).toBe(calculateFleaNet(1000, 1000, 1));
  });
});
