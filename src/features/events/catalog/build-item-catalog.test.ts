import { describe, expect, it } from "vitest";

import { buildItemCatalog, type CatalogSourceData } from "./build-item-catalog";
import { buildCatalogIndex } from "./catalog-index";

/** A trimmed copy of tarkov.dev's real shapes: handbook categories plus a few items of each awkward kind. */
const SOURCE: CatalogSourceData = {
  handbookCategories: {
    gear: {
      id: "gear",
      name: "Gear",
      normalizedName: "gear",
      imageLink: "gear.webp",
      parent: null,
    },
    rigs: {
      id: "rigs",
      name: "Tactical rigs",
      normalizedName: "tactical-rigs",
      imageLink: "rigs.webp",
      parent: "gear",
    },
    headgear: { id: "headgear", name: "Headgear", normalizedName: "headgear", parent: "gear" },
    comps: {
      id: "comps",
      name: "Gear components",
      normalizedName: "gear-components",
      parent: "gear",
    },
    keys: { id: "keys", name: "Keys", normalizedName: "keys", parent: null },
    mech: {
      id: "mech",
      name: "Mechanical keys",
      normalizedName: "mechanical-keys",
      parent: "keys",
    },
    ammo: { id: "ammo", name: "Ammo", normalizedName: "ammo", parent: null },
    rounds: { id: "rounds", name: "Rounds", normalizedName: "rounds", parent: "ammo" },
  },
  itemCategories: {
    plateCat: { normalizedName: "armor-plate" },
    visorCat: { normalizedName: "visors" },
  },
  items: {
    tagged: {
      id: "tagged",
      types: ["armor", "rig"],
      handbookCategories: ["rigs", "gear"],
      properties: { class: 4 },
    },
    avs: {
      id: "avs",
      types: ["rig"],
      handbookCategories: ["rigs", "gear"],
      properties: { class: 0, armorSlots: [{}, {}] },
    },
    bank: { id: "bank", types: ["rig"], handbookCategories: ["rigs", "gear"], properties: {} },
    ssh: {
      id: "ssh",
      handbookCategories: ["headgear", "gear"],
      properties: { propertiesType: "ItemPropertiesHelmet", class: 2 },
    },
    cap: {
      id: "cap",
      handbookCategories: ["headgear", "gear"],
      properties: { propertiesType: "ItemPropertiesHeadwear" },
    },
    plate: {
      id: "plate",
      categories: ["plateCat"],
      handbookCategories: ["comps", "gear"],
      properties: { class: 6 },
    },
    visor: {
      id: "visor",
      categories: ["visorCat"],
      handbookCategories: ["comps", "gear"],
      properties: { class: 0 },
    },
    key: { id: "key", handbookCategories: ["mech", "keys"] },
    m80: {
      id: "m80",
      handbookCategories: ["rounds", "ammo"],
      properties: { penetrationPower: 41, damage: 80 },
    },
    preset: { id: "preset", types: ["preset"], handbookCategories: ["rigs", "gear"] },
  },
};

describe("buildItemCatalog", () => {
  const catalog = buildItemCatalog(SOURCE);

  it("splits rigs and headgear, and pulls plates out of gear components", () => {
    expect(catalog.items.tagged?.c).toBe("tg-armored-rigs");
    // Plate carriers with no class of their own and no armor tag still count as armored.
    expect(catalog.items.avs?.c).toBe("tg-armored-rigs");
    expect(catalog.items.bank?.c).toBe("tg-unarmored-rigs");
    expect(catalog.items.ssh?.c).toBe("tg-helmets");
    expect(catalog.items.cap?.c).toBe("tg-other-headwear");
    expect(catalog.items.plate).toEqual({ c: "tg-armor-plates", ac: 6 });
    expect(catalog.items.visor).toEqual({ c: "comps" });
  });

  it("keeps ammo stats and leaves out keys and weapon presets", () => {
    expect(catalog.items.m80).toEqual({ c: "rounds", pen: 41, dmg: 80 });
    expect(catalog.items.key).toBeUndefined();
    expect(catalog.items.preset).toBeUndefined();
    expect(catalog.categories.some((category) => category.slug === "keys")).toBe(false);
  });

  it("hangs synthetic categories under their handbook parent, with its icon", () => {
    const index = buildCatalogIndex(catalog);
    expect(index.categoriesOfItem("avs")).toEqual(["tg-armored-rigs", "rigs", "gear"]);
    expect(index.categoriesById.get("tg-armored-rigs")).toMatchObject({
      parent: "rigs",
      icon: "rigs.webp",
      synthetic: true,
    });
    expect(index.depth("tg-armored-rigs")).toBe(2);
    expect([...index.descendantsOf("rigs")].sort()).toEqual([
      "rigs",
      "tg-armored-rigs",
      "tg-unarmored-rigs",
    ]);
  });
});
