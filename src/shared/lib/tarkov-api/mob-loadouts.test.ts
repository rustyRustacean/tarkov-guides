import { describe, expect, it } from "vitest";

import { joinMobs, summarizeMob } from "./mob-loadouts";

import type { JsonApiMapsData, JsonApiMob, JsonApiMobEquipmentEntry } from "./json-api-types";

function worn(slot: string, item: string, contains: JsonApiMobEquipmentEntry["contains"] = []) {
  return { item, count: 1, attributes: { slot }, contains };
}

function makeMob(overrides: Partial<JsonApiMob> = {}): JsonApiMob {
  return {
    id: "bossBoar",
    name: "Kaban",
    normalizedName: "kaban",
    imagePortraitLink: "https://assets.tarkov.dev/kaban-portrait.png",
    ...overrides,
  };
}

describe("summarizeMob", () => {
  it("estimates each worn item's chance from how many sample loadouts it appeared in", () => {
    // 5 samples: the primary slot is filled every time (PKP x4, PKM x1),
    // glasses only twice.
    const mob = makeMob({
      equipment: [
        ...Array.from({ length: 4 }, () => worn("FirstPrimaryWeapon", "pkp")),
        worn("FirstPrimaryWeapon", "pkm"),
        worn("Eyewear", "raybench"),
        worn("Eyewear", "raybench"),
      ],
    });
    const summary = summarizeMob(mob);
    expect(summary.gearSamples).toBe(5);
    expect(summary.gear).toEqual([
      { slot: "FirstPrimaryWeapon", itemId: "pkp", chance: 0.8 },
      { slot: "FirstPrimaryWeapon", itemId: "pkm", chance: 0.2 },
      { slot: "Eyewear", itemId: "raybench", chance: 0.4 },
    ]);
  });

  it("ignores nested slots (pocket, bag and secure container contents, plates, loose rounds)", () => {
    const mob = makeMob({
      equipment: [
        worn("FirstPrimaryWeapon", "pkp"),
        worn("pocket1", "afak"),
        worn("main", "ammo-in-secure-container"),
        worn("cartridges", "loose-round"),
        worn("Front_plate", "plate"),
      ],
    });
    const summary = summarizeMob(mob);
    expect(summary.gearSamples).toBe(1);
    expect(summary.gear.map((option) => option.itemId)).toEqual(["pkp"]);
  });

  it("collects a weapon's loaded rounds (magazine and chamber), not its attachments", () => {
    const mob = makeMob({
      equipment: [
        worn("FirstPrimaryWeapon", "pkp", [
          { item: "scope", count: 1, attributes: { slotNameId: "mod_scope" } },
          { item: "lps", count: 1, attributes: { slotNameId: "cartridges" } },
          { item: "lps", count: 1, attributes: { slotNameId: "cartridges" } },
          { item: "bt", count: 1, attributes: { slotNameId: "patron_in_weapon" } },
        ]),
      ],
    });
    expect(summarizeMob(mob).gear[0]?.ammoItemIds).toEqual(["lps", "bt"]);
  });

  it("turns loot prevalence (a 0..100 percentage) into a 0..1 chance, keeping 2-decimal percentages exact", () => {
    const mob = makeMob({
      items: [
        { id: "afak", attributes: { difficulty: "normal", prevalence: 100 } },
        { id: "rusted-key", attributes: { difficulty: "normal", prevalence: 0.23 } },
      ],
    });
    expect(summarizeMob(mob).loot).toEqual([
      { itemId: "afak", chance: 1 },
      { itemId: "rusted-key", chance: 0.0023 },
    ]);
  });

  it("drops loot whose prevalence rounded to 0 upstream", () => {
    const mob = makeMob({ items: [{ id: "never", attributes: { prevalence: 0 } }] });
    expect(summarizeMob(mob).loot).toEqual([]);
  });

  it("keeps HP per body part plus their total, and degrades to empty data when upstream ships none", () => {
    const summary = summarizeMob(
      makeMob({
        health: [
          { id: "Head", max: 85 },
          { id: "Chest", max: 355 },
        ],
      }),
    );
    expect(summary.health).toBe(440);
    expect(summary.healthParts).toEqual([
      { part: "Head", max: 85 },
      { part: "Chest", max: 355 },
    ]);

    expect(summarizeMob(makeMob())).toEqual({
      id: "bossBoar",
      name: "Kaban",
      normalizedName: "kaban",
      imagePortraitLink: "https://assets.tarkov.dev/kaban-portrait.png",
      health: null,
      healthParts: [],
      gearSamples: 0,
      gear: [],
      loot: [],
    });
  });
});

describe("joinMobs", () => {
  it("summarizes every map boss once plus the Goons' squadmates, skipping other escorts", () => {
    const mapsData: JsonApiMapsData = {
      maps: {
        a: {
          name: "Customs",
          normalizedName: "customs",
          raidDuration: null,
          players: null,
          bosses: [
            { mob: "bossKnight", spawnChance: 0.3 },
            { mob: "bossBully", spawnChance: 0.4 },
          ],
        },
        b: {
          name: "Woods",
          normalizedName: "woods",
          raidDuration: null,
          players: null,
          bosses: [{ mob: "bossKnight", spawnChance: 0.3 }],
        },
      },
      mobs: {
        bossKnight: makeMob({ id: "bossKnight", name: "Knight" }),
        bossBully: makeMob({ id: "bossBully", name: "Reshala" }),
        followerBigPipe: makeMob({ id: "followerBigPipe", name: "Big Pipe" }),
        followerBirdEye: makeMob({ id: "followerBirdEye", name: "Birdeye" }),
        followerBully: makeMob({ id: "followerBully", name: "Reshala Guard" }),
      },
    };
    const ids = joinMobs(mapsData)
      .map((mob) => mob.id)
      .sort();
    expect(ids).toEqual(["bossBully", "bossKnight", "followerBigPipe", "followerBirdEye"]);
  });

  it("skips a referenced mob missing from the lookup", () => {
    const mapsData: JsonApiMapsData = {
      maps: {
        a: {
          name: "Customs",
          normalizedName: "customs",
          raidDuration: null,
          players: null,
          bosses: [{ mob: "unknownMob", spawnChance: 0.2 }],
        },
      },
    };
    expect(joinMobs(mapsData)).toEqual([]);
  });
});
