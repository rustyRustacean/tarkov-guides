import { describe, expect, it } from "vitest";

import { buildCatalogIndex } from "../catalog/catalog-index";

import { checkKit, describeRule, kitContents, type Namer } from "./presets";

import type { ItemCatalog } from "../catalog/catalog-types";
import type { Kit, Preset } from "../types";

/** A small catalog shaped like the real one: handbook categories plus the synthetic rig and helmet splits. */
const CATALOG: ItemCatalog = {
  version: 1,
  categories: [
    { id: "weapons", name: "Weapons", slug: "weapons", parent: null, icon: null },
    {
      id: "bolt",
      name: "Bolt-action rifles",
      slug: "bolt-action-rifles",
      parent: "weapons",
      icon: null,
    },
    { id: "dmr", name: "Marksman rifles", slug: "marksman-rifles", parent: "weapons", icon: null },
    { id: "pistols", name: "Pistols", slug: "pistols", parent: "weapons", icon: null },
    { id: "gear", name: "Gear", slug: "gear", parent: null, icon: null },
    { id: "armor", name: "Body armor", slug: "body-armor", parent: "gear", icon: null },
    { id: "rigs", name: "Tactical rigs", slug: "tactical-rigs", parent: "gear", icon: null },
    {
      id: "tg-armored-rigs",
      name: "Armored rigs",
      slug: "tg-armored-rigs",
      parent: "rigs",
      icon: null,
      synthetic: true,
    },
    {
      id: "tg-unarmored-rigs",
      name: "Unarmored rigs",
      slug: "tg-unarmored-rigs",
      parent: "rigs",
      icon: null,
      synthetic: true,
    },
    { id: "headgear", name: "Headgear", slug: "headgear", parent: "gear", icon: null },
    {
      id: "tg-helmets",
      name: "Helmets",
      slug: "tg-helmets",
      parent: "headgear",
      icon: null,
      synthetic: true,
    },
    { id: "meds", name: "Medication", slug: "medication", parent: null, icon: null },
    { id: "injectors", name: "Injectors", slug: "injectors", parent: "meds", icon: null },
    { id: "medkits", name: "Medkits", slug: "medkits", parent: "meds", icon: null },
    { id: "ammo", name: "Ammo", slug: "ammo", parent: null, icon: null },
    { id: "rounds", name: "Rounds", slug: "rounds", parent: "ammo", icon: null },
  ],
  items: {
    m700: { c: "bolt" },
    rsass: { c: "dmr" },
    glock: { c: "pistols" },
    sixb43: { c: "armor", ac: 6 },
    avs: { c: "tg-armored-rigs", ac: 4 },
    slick: { c: "tg-armored-rigs", ac: 6 },
    bankrobber: { c: "tg-unarmored-rigs" },
    ssh68: { c: "tg-helmets", ac: 2 },
    morphine: { c: "injectors" },
    propital: { c: "injectors" },
    salewa: { c: "medkits" },
    ifak: { c: "medkits" },
    m80: { c: "rounds", pen: 41, dmg: 80 },
  },
};

const index = buildCatalogIndex(CATALOG);
const names: Namer = {
  item: (id) => id,
  category: (id) => index.categoriesById.get(id)?.name ?? id,
};

/** The organizer's bolt-action specialist, from the original request. */
const BOLT_SPECIALIST: Preset = {
  id: "bolt",
  name: "Bolt-action specialist",
  description: "",
  rules: [
    { id: "r1", kind: "ban", target: { type: "category", id: "armor" } },
    { id: "r2", kind: "ban", target: { type: "category", id: "tg-helmets" } },
    {
      id: "r3",
      kind: "allowOnly",
      scope: { type: "category", id: "weapons" },
      allowed: [{ type: "category", id: "bolt" }],
    },
    { id: "r4", kind: "ban", target: { type: "item", id: "rsass" } },
    { id: "r5", kind: "ban", target: { type: "item", id: "propital" } },
    { id: "r6", kind: "cap", target: { type: "item", id: "morphine" }, max: 1 },
    { id: "r7", kind: "cap", target: { type: "item", id: "salewa" }, max: 1 },
    {
      id: "r8",
      kind: "allowOnly",
      scope: { type: "category", id: "meds" },
      allowed: [
        { type: "item", id: "morphine" },
        { type: "item", id: "salewa" },
      ],
    },
    {
      id: "r9",
      kind: "stat",
      stat: "armorClass",
      appliesTo: { type: "category", id: "rigs" },
      max: 4,
    },
    { id: "r10", kind: "require", target: { type: "category", id: "bolt" }, min: 1 },
  ],
};

function ruleIds(kit: Kit, preset: Preset = BOLT_SPECIALIST): string[] {
  return checkKit(kit, preset, index, names).violations.map((violation) => violation.ruleId);
}

describe("checkKit", () => {
  it("passes a kit that follows every rule", () => {
    const kit: Kit = {
      slots: {
        primary: { itemId: "m700", attachments: [], ammo: { itemId: "m80", qty: 30 } },
        rig: { itemId: "avs", attachments: [] },
      },
      carried: [
        { itemId: "morphine", qty: 1 },
        { itemId: "salewa", qty: 1 },
      ],
    };
    expect(checkKit(kit, BOLT_SPECIALIST, index, names)).toEqual({ ok: true, violations: [] });
  });

  it("reports each broken rule once, with the items that broke it", () => {
    const kit: Kit = {
      slots: {
        primary: { itemId: "rsass", attachments: [] },
        armor: { itemId: "sixb43", attachments: [] },
        headwear: { itemId: "ssh68", attachments: [] },
        rig: { itemId: "slick", attachments: [] },
      },
      carried: [
        { itemId: "morphine", qty: 2 },
        { itemId: "propital", qty: 1 },
        { itemId: "ifak", qty: 1 },
      ],
    };
    const { ok, violations } = checkKit(kit, BOLT_SPECIALIST, index, names);
    expect(ok).toBe(false);
    expect(violations.map((v) => v.ruleId)).toEqual([
      "r1",
      "r2",
      "r3",
      "r4",
      "r5",
      "r6",
      "r8",
      "r9",
      "r10",
    ]);
    expect(violations.find((v) => v.ruleId === "r8")?.itemIds).toEqual(["propital", "ifak"]);
    expect(violations.find((v) => v.ruleId === "r6")?.message).toBe(
      "At most 1× morphine (this kit has 2)",
    );
    expect(violations.find((v) => v.ruleId === "r9")?.message).toBe(
      "Tactical rigs must have armor class 4 or lower",
    );
  });

  it("lets a more specific allow override a broader ban", () => {
    const preset: Preset = {
      id: "p",
      name: "No rigs but the AVS",
      description: "",
      rules: [
        { id: "ban", kind: "ban", target: { type: "category", id: "rigs" } },
        { id: "ok", kind: "allow", target: { type: "item", id: "avs" } },
      ],
    };
    expect(
      ruleIds({ slots: { rig: { itemId: "avs", attachments: [] } }, carried: [] }, preset),
    ).toEqual([]);
    expect(
      ruleIds({ slots: { rig: { itemId: "slick", attachments: [] } }, carried: [] }, preset),
    ).toEqual(["ban"]);
  });

  it("bans body armor without touching armored rigs", () => {
    const preset: Preset = {
      id: "p",
      name: "No armor",
      description: "",
      rules: [{ id: "ban", kind: "ban", target: { type: "category", id: "armor" } }],
    };
    expect(
      ruleIds({ slots: { rig: { itemId: "slick", attachments: [] } }, carried: [] }, preset),
    ).toEqual([]);
  });

  it("counts caps across worn, attached and carried items", () => {
    const preset: Preset = {
      id: "p",
      name: "Ammo cap",
      description: "",
      rules: [{ id: "cap", kind: "cap", target: { type: "category", id: "rounds" }, max: 60 }],
    };
    const kit: Kit = {
      slots: { primary: { itemId: "m700", attachments: [], ammo: { itemId: "m80", qty: 40 } } },
      carried: [{ itemId: "m80", qty: 30 }],
    };
    expect(kitContents(kit)).toContainEqual({ itemId: "m80", qty: 70 });
    expect(ruleIds(kit, preset)).toEqual(["cap"]);
  });

  it("ignores items the catalog doesn't know for category rules, but not for item rules", () => {
    const preset: Preset = {
      id: "p",
      name: "No bitcoin",
      description: "",
      rules: [
        { id: "cat", kind: "ban", target: { type: "category", id: "meds" } },
        { id: "item", kind: "ban", target: { type: "item", id: "bitcoin" } },
      ],
    };
    expect(ruleIds({ slots: {}, carried: [{ itemId: "bitcoin", qty: 1 }] }, preset)).toEqual([
      "item",
    ]);
  });
});

describe("describeRule", () => {
  it("reads each rule as a sentence", () => {
    expect(BOLT_SPECIALIST.rules.map((rule) => describeRule(rule, names))).toEqual([
      "No Body armor",
      "No Helmets",
      "Weapons: only Bolt-action rifles",
      "No rsass",
      "No propital",
      "At most 1× morphine",
      "At most 1× salewa",
      "Medication: only morphine or salewa",
      "Tactical rigs: armor class 4 or lower",
      "At least 1× Bolt-action rifles",
    ]);
  });
});
