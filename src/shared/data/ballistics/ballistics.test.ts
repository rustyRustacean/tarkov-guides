import { describe, expect, it } from "vitest";

import { AMMO_ITEMS, ARMOR_ITEMS, PLATE_ITEMS, RIG_ITEMS } from "./ballistics";

describe("AMMO_ITEMS", () => {
  it("is non-empty", () => {
    expect(AMMO_ITEMS.length).toBeGreaterThan(0);
  });

  it("has the expected stats for a known round", () => {
    const m855 = AMMO_ITEMS.find((item) => item.shortName === "M855");
    expect(m855?.properties).toEqual({
      caliber: "Caliber556x45NATO",
      damage: 54,
      armorDamage: 37,
      penetrationPower: 31,
      penetrationChance: 0.5,
      fragmentationChance: 0.5,
      ricochetChance: 0.4,
      tracer: false,
      ammoType: "bullet",
    });
  });

  it("has some entries with empty properties (grenades/ammo-pack containers, not true ammo)", () => {
    expect(AMMO_ITEMS.some((item) => Object.keys(item.properties).length === 0)).toBe(true);
  });
});

describe("ARMOR_ITEMS", () => {
  it("is non-empty", () => {
    expect(ARMOR_ITEMS.length).toBeGreaterThan(0);
  });

  it("has the expected stats for a known armor", () => {
    const zabralo = ARMOR_ITEMS.find((item) => item.shortName === "6B43");
    expect(zabralo?.properties).toMatchObject({
      class: 6,
      durability: 510,
      armorType: "Heavy",
      material: { id: "Aramid", name: "Aramid" },
    });
  });
});

describe("PLATE_ITEMS", () => {
  it("is non-empty", () => {
    expect(PLATE_ITEMS.length).toBeGreaterThan(0);
  });

  it("carries no stat data today - every entry has empty properties (regression guard: if tarkov-tips's upstream source is ever regenerated with populated stats, this should fail loudly)", () => {
    for (const item of PLATE_ITEMS) {
      expect(Object.keys(item.properties)).toHaveLength(0);
    }
  });
});

describe("RIG_ITEMS", () => {
  it("is non-empty", () => {
    expect(RIG_ITEMS.length).toBeGreaterThan(0);
  });

  it("carries no stat data today - every entry has empty properties", () => {
    for (const item of RIG_ITEMS) {
      expect(Object.keys(item.properties)).toHaveLength(0);
    }
  });
});
