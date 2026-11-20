import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MODIFIER_CATEGORIES, MODIFIER_CLASHES, SEASONAL_MODIFIERS } from "./seasonal-modifiers";

const byId = new Map(SEASONAL_MODIFIERS.map((modifier) => [modifier.id, modifier]));

describe("SEASONAL_MODIFIERS", () => {
  it("matches BSG's Season 2 image: 6 global, 31 positive, 25 negative", () => {
    const count = (kind: string) => SEASONAL_MODIFIERS.filter((m) => m.kind === kind).length;
    expect([count("global"), count("positive"), count("negative")]).toEqual([6, 31, 25]);
  });

  it("uses unique ids", () => {
    expect(byId.size).toBe(SEASONAL_MODIFIERS.length);
  });

  it("signs points by kind: costs negative, gains positive, globals zero", () => {
    for (const modifier of SEASONAL_MODIFIERS) {
      if (modifier.kind === "positive") expect(modifier.points, modifier.id).toBeLessThan(0);
      if (modifier.kind === "negative") expect(modifier.points, modifier.id).toBeGreaterThan(0);
      if (modifier.kind === "global") expect(modifier.points, modifier.id).toBe(0);
    }
  });

  it("has an icon file for every modifier, tarkov.dev's for returning ones", () => {
    for (const modifier of SEASONAL_MODIFIERS) {
      expect(existsSync(join(process.cwd(), "public", modifier.icon)), modifier.id).toBe(true);
      expect(modifier.icon.endsWith(modifier.returning ? ".webp" : ".png"), modifier.id).toBe(true);
    }
  });
});

describe("MODIFIER_CATEGORIES", () => {
  it("only lists real modifiers, each once per category", () => {
    for (const category of MODIFIER_CATEGORIES) {
      expect(new Set(category.members).size, category.id).toBe(category.members.length);
      for (const id of category.members) expect(byId.has(id), `${category.id}: ${id}`).toBe(true);
    }
  });

  it("puts every modifier in at least one category", () => {
    const covered = new Set(MODIFIER_CATEGORIES.flatMap((category) => category.members));
    for (const modifier of SEASONAL_MODIFIERS)
      expect(covered.has(modifier.id), modifier.id).toBe(true);
  });
});

describe("MODIFIER_CLASHES", () => {
  it("pairs two different personal modifiers, never the same pair twice", () => {
    const seen = new Set<string>();
    for (const clash of MODIFIER_CLASHES) {
      expect(clash.a).not.toBe(clash.b);
      for (const id of [clash.a, clash.b]) {
        expect(byId.get(id)?.kind, id).toMatch(/positive|negative/);
      }
      const key = [clash.a, clash.b].sort().join("+");
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("gives every guess a reason and keeps Season 1 pairs to returning modifiers", () => {
    for (const clash of MODIFIER_CLASHES) {
      if (clash.source === "guess") expect(clash.reason, `${clash.a}+${clash.b}`).toBeTruthy();
      if (clash.source === "season1") {
        expect(byId.get(clash.a)?.returning && byId.get(clash.b)?.returning).toBe(true);
      }
    }
  });
});
