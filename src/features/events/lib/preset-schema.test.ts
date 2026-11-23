import { describe, expect, it } from "vitest";

import { parseKit, parsePreset } from "./preset-schema";

describe("parsePreset", () => {
  it("keeps valid rules and drops malformed or unmatchable ones", () => {
    const preset = parsePreset({
      id: "p1",
      name: "  DMR specialist ",
      description: "Marksman rifles only",
      rules: [
        { id: "a", kind: "ban", target: { type: "category", id: "tg-helmets" } },
        { id: "a", kind: "ban", target: { type: "item", id: "dup" } },
        { id: "b", kind: "cap", target: { type: "item", id: "morphine" }, max: 1.5 },
        { id: "c", kind: "stat", stat: "armorClass", appliesTo: { type: "item", id: "x" }, max: 4 },
        { id: "d", kind: "stat", stat: "armorClass", appliesTo: { type: "category", id: "armor" } },
        {
          id: "e",
          kind: "stat",
          stat: "ammoPen",
          appliesTo: { type: "category", id: "rounds" },
          max: 40,
          note: "No M61",
        },
        { id: "f", kind: "teleport" },
        {
          id: "g",
          kind: "allowOnly",
          scope: { type: "category", id: "weapons" },
          allowed: [{ type: "category", id: "dmr" }, { type: "bad" }],
        },
      ],
    });
    expect(preset).toEqual({
      id: "p1",
      name: "DMR specialist",
      description: "Marksman rifles only",
      rules: [
        { id: "a", kind: "ban", target: { type: "category", id: "tg-helmets" } },
        {
          id: "e",
          kind: "stat",
          stat: "ammoPen",
          appliesTo: { type: "category", id: "rounds" },
          max: 40,
          note: "No M61",
        },
        {
          id: "g",
          kind: "allowOnly",
          scope: { type: "category", id: "weapons" },
          allowed: [{ type: "category", id: "dmr" }],
        },
      ],
    });
  });

  it("rejects a preset with no name", () => {
    expect(parsePreset({ id: "p", name: " ", rules: [] })).toBeNull();
  });
});

describe("parseKit", () => {
  it("keeps known slots and positive stacks only", () => {
    expect(
      parseKit({
        slots: {
          primary: { itemId: "m700", attachments: ["scope", 7], ammo: { itemId: "m80", qty: 0 } },
          jetpack: { itemId: "x", attachments: [] },
        },
        carried: [{ itemId: "morphine", qty: 1 }, { itemId: "salewa", qty: -1 }, "junk"],
      }),
    ).toEqual({
      slots: { primary: { itemId: "m700", attachments: ["scope"] } },
      carried: [{ itemId: "morphine", qty: 1 }],
    });
    expect(parseKit(null)).toEqual({ slots: {}, carried: [] });
  });
});
