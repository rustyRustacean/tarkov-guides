import { describe, expect, it } from "vitest";

import { BEGINNER_ITEMS } from "./beginner-items";

describe("BEGINNER_ITEMS", () => {
  it("has exactly the 4 curated categories", () => {
    expect(BEGINNER_ITEMS.map((category) => category.category)).toEqual([
      "Hideout essentials",
      "Early trader quests",
      "Early flea flips (cash flow)",
      "Barter targets (save these)",
    ]);
  });

  it("has 54 total entries across all categories, matching the legacy source", () => {
    const total = BEGINNER_ITEMS.reduce((sum, category) => sum + category.items.length, 0);
    expect(total).toBe(54);
  });

  it("every entry has both a short and a nameLike", () => {
    for (const category of BEGINNER_ITEMS) {
      for (const item of category.items) {
        expect(item.short).toBeTruthy();
        expect(item.nameLike).toBeTruthy();
      }
    }
  });

  it("spot-checks the LEDX entry against the legacy source", () => {
    const traderQuests = BEGINNER_ITEMS.find(
      (category) => category.category === "Early trader quests",
    );
    expect(traderQuests?.items).toContainEqual({ short: "LEDX", nameLike: "ledx" });
  });
});
