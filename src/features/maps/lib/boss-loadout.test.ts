import { describe, expect, it } from "vitest";

import {
  PMC_TOTAL_HP,
  filterLoot,
  formatChance,
  getBossLoadout,
  lootCategoryOf,
  lootTier,
} from "./boss-loadout";

import type { NormalizedItem, RawMob } from "@/shared/lib/tarkov-api/types";

function makeMob(overrides: Partial<RawMob> & Pick<RawMob, "id">): RawMob {
  return {
    name: overrides.id,
    normalizedName: overrides.id,
    imagePortraitLink: null,
    health: null,
    healthParts: [],
    gearSamples: 0,
    gear: [],
    loot: [],
    ...overrides,
  };
}

function byId(...mobs: RawMob[]): Record<string, RawMob> {
  return Object.fromEntries(mobs.map((mob) => [mob.id, mob]));
}

function item(id: string, name: string, types: readonly string[] = []): NormalizedItem {
  return {
    id,
    name,
    shortName: name.slice(0, 4),
    iconLink: null,
    wikiLink: null,
    basePrice: 0,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types,
    traderSell: 0,
    traderSellVendor: "",
    traderBuy: 0,
    traderBuyVendor: "",
    buyOffers: [],
    avg24hPve: null,
    lastLowPve: null,
    changePve: null,
  };
}

describe("getBossLoadout", () => {
  it("groups one boss's gear by slot in weapons-first order, most common option first", () => {
    const kaban = makeMob({
      id: "bossBoar",
      health: 1300,
      gearSamples: 15,
      gear: [
        { slot: "Eyewear", itemId: "raybench", chance: 0.4 },
        { slot: "FirstPrimaryWeapon", itemId: "pkm", chance: 0.2 },
        { slot: "FirstPrimaryWeapon", itemId: "pkp", chance: 0.8, ammoItemIds: ["lps"] },
        { slot: "Holster", itemId: "deagle", chance: 0.4 },
      ],
    });
    const loadout = getBossLoadout(["bossBoar"], byId(kaban));
    expect(loadout?.sourceCount).toBe(1);
    expect(loadout?.health).toBe(1300);
    expect(loadout?.gearSamples).toBe(15);
    expect(loadout?.gear.map((slot) => slot.label)).toEqual(["Primary", "Sidearm", "Eyewear"]);
    expect(loadout?.gear[0]?.options).toEqual([
      { itemId: "pkp", chance: 0.8, ammoItemIds: ["lps"] },
      { itemId: "pkm", chance: 0.2, ammoItemIds: [] },
    ]);
  });

  it("shows a worn slot the label table doesn't know under its raw id, last", () => {
    const mob = makeMob({
      id: "m",
      gearSamples: 1,
      gear: [
        { slot: "NewSlot", itemId: "x", chance: 1 },
        { slot: "Headwear", itemId: "helmet", chance: 1 },
      ],
    });
    expect(getBossLoadout(["m"], byId(mob))?.gear.map((slot) => slot.label)).toEqual([
      "Headwear",
      "NewSlot",
    ]);
  });

  it("pools a faction pill's mobs: gear weighted by sample count, loot averaged", () => {
    const a = makeMob({
      id: "a",
      health: 790,
      gearSamples: 15,
      gear: [{ slot: "Headwear", itemId: "helmet", chance: 1 }],
      loot: [{ itemId: "key", chance: 0.2 }],
    });
    const b = makeMob({
      id: "b",
      gearSamples: 45,
      gear: [{ slot: "Headwear", itemId: "helmet", chance: 0.2 }],
      loot: [{ itemId: "chain", chance: 0.1 }],
    });
    const loadout = getBossLoadout(["a", "b"], byId(a, b));
    expect(loadout?.sourceCount).toBe(2);
    expect(loadout?.health).toBe(790);
    expect(loadout?.gearSamples).toBe(60);
    // (1 * 15 + 0.2 * 45) / 60 = 0.4
    expect(loadout?.gear[0]?.options[0]?.chance).toBeCloseTo(0.4);
    expect(loadout?.loot).toEqual([
      { itemId: "key", chance: 0.1 },
      { itemId: "chain", chance: 0.05 },
    ]);
  });

  it("skips a mob with no data instead of counting it as 0% for everything", () => {
    const rogue = makeMob({ id: "ExUsec", loot: [{ itemId: "key", chance: 0.4 }] });
    const empty = makeMob({ id: "exUsecFree" });
    const loadout = getBossLoadout(["ExUsec", "exUsecFree"], byId(rogue, empty));
    expect(loadout?.sourceCount).toBe(1);
    expect(loadout?.loot).toEqual([{ itemId: "key", chance: 0.4 }]);
  });

  it("orders and labels the main mob's body parts head to toe, with a PMC's HP alongside", () => {
    const kaban = makeMob({
      id: "bossBoar",
      health: 1300,
      loot: [{ itemId: "afak", chance: 1 }],
      // Upstream's own (alphabetical) order, plus one part the table doesn't know.
      healthParts: [
        { part: "Chest", max: 355 },
        { part: "Head", max: 85 },
        { part: "LeftArm", max: 150 },
        { part: "Tail", max: 1 },
        { part: "Stomach", max: 260 },
      ],
    });
    const loadout = getBossLoadout(["bossBoar"], byId(kaban));
    expect(loadout?.healthParts).toEqual([
      { part: "Head", label: "Head", max: 85, pmcMax: 35 },
      { part: "Chest", label: "Thorax", max: 355, pmcMax: 85 },
      { part: "Stomach", label: "Stomach", max: 260, pmcMax: 70 },
      { part: "LeftArm", label: "Left arm", max: 150, pmcMax: 60 },
      { part: "Tail", label: "Tail", max: 1, pmcMax: null },
    ]);
    expect(PMC_TOTAL_HP).toBe(440);
  });

  it("returns null when none of the pill's mobs has any data, or none is known", () => {
    expect(getBossLoadout(["exUsecFree"], byId(makeMob({ id: "exUsecFree" })))).toBeNull();
    expect(getBossLoadout(["missing"], {})).toBeNull();
  });
});

describe("lootTier", () => {
  it("bands at 10% and 1%", () => {
    expect(lootTier(1)).toBe("common");
    expect(lootTier(0.1)).toBe("common");
    expect(lootTier(0.0999)).toBe("uncommon");
    expect(lootTier(0.01)).toBe("uncommon");
    expect(lootTier(0.0023)).toBe("rare");
  });
});

describe("formatChance", () => {
  it("uses just enough precision for each range and drops trailing zeros", () => {
    expect(formatChance(1)).toBe("100%");
    expect(formatChance(0.7031)).toBe("70%");
    expect(formatChance(0.061)).toBe("6.1%");
    expect(formatChance(0.05)).toBe("5%");
    expect(formatChance(0.0023)).toBe("0.23%");
    expect(formatChance(0.002)).toBe("0.2%");
    expect(formatChance(0.00004)).toBe("<0.01%");
  });
});

describe("lootCategoryOf", () => {
  it("buckets by tarkov.dev item types, keys first, unknown items as other", () => {
    expect(lootCategoryOf(item("k", "Key", ["keys", "barter"]))).toBe("keys");
    expect(lootCategoryOf(item("m", "Morphine", ["injectors", "meds"]))).toBe("meds");
    expect(lootCategoryOf(item("c", "Chain", ["barter"]))).toBe("barter");
    expect(lootCategoryOf(item("n", "Note", ["noFlea"]))).toBe("other");
    expect(lootCategoryOf(undefined)).toBe("other");
  });
});

describe("filterLoot", () => {
  const items = {
    key: item("key", "Rusted bloody key", ["keys"]),
    afak: item("afak", "AFAK first aid kit", ["meds"]),
  };
  const loot = [
    { itemId: "afak", chance: 1 },
    { itemId: "key", chance: 0.0023 },
  ];

  it("matches the name or short name, case-insensitively", () => {
    expect(filterLoot(loot, items, "RUSTED", "all")).toEqual([loot[1]]);
    expect(filterLoot(loot, items, "afak", "all")).toEqual([loot[0]]);
  });

  it("narrows to a category, and combines with the query", () => {
    expect(filterLoot(loot, items, "", "meds")).toEqual([loot[0]]);
    expect(filterLoot(loot, items, "rusted", "meds")).toEqual([]);
  });

  it("returns everything for an empty or whitespace query on 'all'", () => {
    expect(filterLoot(loot, items, "  ", "all")).toEqual(loot);
  });
});
