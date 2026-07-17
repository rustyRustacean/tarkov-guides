import { describe, expect, it } from "vitest";

import { ITEM_LOCATIONS } from "./item-locations";

describe("ITEM_LOCATIONS", () => {
  it("has exactly 102 entries, matching the legacy source", () => {
    expect(Object.keys(ITEM_LOCATIONS)).toHaveLength(102);
  });

  it("every entry has a non-empty match array and general hint", () => {
    for (const [key, entry] of Object.entries(ITEM_LOCATIONS)) {
      expect(entry.match.length, `${key} should have at least one match needle`).toBeGreaterThan(0);
      expect(entry.general, `${key} should have a general hint`).toBeTruthy();
    }
  });

  it("spot-checks the ledx entry's exact text against the legacy source", () => {
    expect(ITEM_LOCATIONS.ledx).toEqual({
      match: ["ledx"],
      general:
        "Medbags + pharmacy spawns only. Extremely rare - worth 200k+ FIR. Always FIR-hand-in priority.",
      perMap: {
        customs: "New gas station medical · ZB-013 medbags · saferoom med spawns",
        reserve: "D-2 medical · hermetic door 2 · field medic crates · barracks med",
        woods: "Scav house medbag · UN camp medbags · USEC camp · outskirts med",
        "streets-of-tarkov":
          "Primorsky clinic med storage · Cardinal pharmacy · Pinewood pharmacy · Concordia upper floors",
        shoreline:
          "Resort east 222/226 med storage · west 303/306 · village pharmacy · pier medical",
        interchange: "IDEA medical aisle · Kiba medbag · Rasmussen first-aid",
        lighthouse: "Water treatment med · Rogue chalet pharmacy · village medical",
        "the-lab": "Medical storage rooms · R&D zone medical · black keycard med room",
        "ground-zero": "Infirmary medbags · medical bay drawers · pharmacy desks",
      },
    });
  });

  it("only uses the 9 map slugs the legacy data actually covers (no factory/terminal/ice-breaker hints)", () => {
    const seenMapKeys = new Set<string>();
    for (const entry of Object.values(ITEM_LOCATIONS)) {
      for (const mapKey of Object.keys(entry.perMap)) {
        seenMapKeys.add(mapKey);
      }
    }
    expect([...seenMapKeys].sort()).toEqual([
      "customs",
      "ground-zero",
      "interchange",
      "lighthouse",
      "reserve",
      "shoreline",
      "streets-of-tarkov",
      "the-lab",
      "woods",
    ]);
  });
});
