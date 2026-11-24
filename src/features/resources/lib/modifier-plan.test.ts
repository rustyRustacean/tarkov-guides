import { describe, expect, it } from "vitest";

import {
  activeClashes,
  clashPartners,
  formatGained,
  formatModifierPoints,
  formatSpent,
  isHighlighted,
  planStatus,
  summarizePoints,
} from "./modifier-plan";

import type { ModifierClash, SeasonalModifier } from "../data/seasonal-modifiers";

function modifier(id: string, kind: SeasonalModifier["kind"], points: number): SeasonalModifier {
  return { id, name: id, kind, points, effects: [], icon: "", returning: false };
}

const CLASHES: readonly ModifierClash[] = [
  { a: "x", b: "y", source: "season1" },
  { a: "x", b: "z", source: "guess", reason: "because" },
];

describe("summarizePoints", () => {
  it("adds gains and costs separately and nets them", () => {
    expect(
      summarizePoints([
        modifier("cost", "positive", -4),
        modifier("gain", "negative", 3),
        modifier("global", "global", 0),
      ]),
    ).toEqual({ gained: 3, spent: 4, balance: -1 });
  });

  it("is all zeros with nothing picked", () => {
    expect(summarizePoints([])).toEqual({ gained: 0, spent: 0, balance: 0 });
  });
});

describe("activeClashes", () => {
  it("lists pairs whose two sides are both picked", () => {
    expect(activeClashes(new Set(["x", "y", "z"]), CLASHES, true)).toHaveLength(2);
    expect(activeClashes(new Set(["x"]), CLASHES, true)).toHaveLength(0);
  });

  it("drops guesses when they're switched off", () => {
    expect(activeClashes(new Set(["x", "y", "z"]), CLASHES, false)).toEqual([CLASHES[0]]);
  });
});

describe("clashPartners", () => {
  it("finds the other side from either end", () => {
    expect(clashPartners("x", CLASHES, true).map((p) => p.id)).toEqual(["y", "z"]);
    expect(clashPartners("y", CLASHES, true).map((p) => p.id)).toEqual(["x"]);
    expect(clashPartners("x", CLASHES, false).map((p) => p.id)).toEqual(["y"]);
  });
});

describe("isHighlighted", () => {
  const all = { categories: new Set<never>(), showPositive: true, showNegative: true };
  const positive = modifier("p", "positive", -1);
  const negative = modifier("n", "negative", 1);
  const global = modifier("g", "global", 0);

  it("highlights everything with no filter", () => {
    for (const m of [positive, negative, global])
      expect(isHighlighted(m, new Set(), all)).toBe(true);
  });

  it("keeps only members of the chosen categories", () => {
    const filter = { ...all, categories: new Set(["food" as const]) };
    expect(isHighlighted(positive, new Set(["food" as const]), filter)).toBe(true);
    expect(isHighlighted(negative, new Set(["skills" as const]), filter)).toBe(false);
    expect(isHighlighted(global, new Set(), filter)).toBe(false);
  });

  it("narrows personal modifiers by polarity, leaving globals to the categories", () => {
    const filter = { ...all, showPositive: false };
    expect(isHighlighted(positive, new Set(), filter)).toBe(false);
    expect(isHighlighted(negative, new Set(), filter)).toBe(true);
    expect(isHighlighted(global, new Set(), filter)).toBe(true);
  });
});

describe("formatModifierPoints", () => {
  it("writes points the way BSG does", () => {
    expect(formatModifierPoints(-2)).toBe("(-2)");
    expect(formatModifierPoints(3)).toBe("(+3)");
  });
});

describe("formatGained and formatSpent", () => {
  it("sign non-zero totals and write zero plainly", () => {
    expect([formatGained(11), formatGained(0)]).toEqual(["+11", "0"]);
    expect([formatSpent(8), formatSpent(0)]).toEqual(["-8", "0"]);
  });
});

describe("planStatus", () => {
  const points = (balance: number) => ({ gained: 0, spent: 0, balance });

  it("puts being short of points first, then clashes", () => {
    expect(planStatus(points(-3), 2, 4)).toEqual({ text: "3 points short", tone: "red" });
    expect(planStatus(points(0), 1, 2)).toEqual({ text: "1 clash", tone: "amber" });
    expect(planStatus(points(0), 2, 4)).toEqual({ text: "2 clashes", tone: "amber" });
  });

  it("says a plan works, or that nothing is picked yet", () => {
    expect(planStatus(points(1), 0, 2)).toEqual({ text: "Plan works", tone: "green" });
    expect(planStatus(points(0), 0, 0)).toEqual({ text: "Nothing picked yet", tone: "muted" });
  });
});
