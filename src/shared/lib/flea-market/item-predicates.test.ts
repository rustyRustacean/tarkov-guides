import { describe, expect, it } from "vitest";

import { isBarterOnly, isDogtag, isMoneyItem, isQuestTool } from "./item-predicates";

describe("isQuestTool", () => {
  it("returns false for null/undefined", () => {
    expect(isQuestTool(null)).toBe(false);
    expect(isQuestTool(undefined)).toBe(false);
  });

  it("returns false for an ordinary item", () => {
    expect(isQuestTool({ name: "LEDX Skin Transilluminator", shortName: "LEDX" })).toBe(false);
  });

  it("matches MS2000 markers by name or shortName", () => {
    expect(isQuestTool({ name: "MS2000 Marker", shortName: "Marker" })).toBe(true);
    expect(isQuestTool({ name: "Something else", shortName: "MS2000" })).toBe(true);
  });

  it("matches signal jammers by name or shortName", () => {
    expect(isQuestTool({ name: "WI-FI Signal Jammer", shortName: "Jammer" })).toBe(true);
    expect(isQuestTool({ name: "Some Signal Jammer device", shortName: "SJ" })).toBe(true);
  });

  it("matches wifi camera by name or shortName, case-insensitively and with/without a hyphen", () => {
    expect(isQuestTool({ name: "WI-FI Camera", shortName: "cam" })).toBe(true);
    expect(isQuestTool({ name: "wifi camera", shortName: "cam" })).toBe(true);
    expect(isQuestTool({ name: "Ordinary Item", shortName: "WifiCam" })).toBe(true);
  });

  it("matches Kerman's cat / hologram items by name", () => {
    expect(isQuestTool({ name: "Kerman's cat hologram", shortName: "cat" })).toBe(true);
    expect(isQuestTool({ name: "Some Hologram Projector", shortName: "holo" })).toBe(true);
  });
});

describe("isMoneyItem", () => {
  it("returns true when types includes 'money'", () => {
    expect(isMoneyItem({ types: ["money"], shortName: "RUB" })).toBe(true);
  });

  it("is case-insensitive when matching the 'money' type", () => {
    expect(isMoneyItem({ types: ["Money"], shortName: "RUB" })).toBe(true);
  });

  it("falls back to a known currency shortName when types has no 'money' tag", () => {
    expect(isMoneyItem({ types: [], shortName: "usd" })).toBe(true);
    expect(isMoneyItem({ types: [], shortName: "EUR" })).toBe(true);
  });

  it("returns false for an ordinary item", () => {
    expect(isMoneyItem({ types: ["gun"], shortName: "AK" })).toBe(false);
  });
});

describe("isBarterOnly", () => {
  it("returns false when types doesn't include 'barter'", () => {
    expect(isBarterOnly({ types: ["ammo"] })).toBe(false);
  });

  it("returns false/true for null/undefined input", () => {
    expect(isBarterOnly(null)).toBe(false);
    expect(isBarterOnly(undefined)).toBe(false);
  });

  it("returns true for a plain barter item with no excluded type", () => {
    expect(isBarterOnly({ types: ["barter"] })).toBe(true);
  });

  it("passes a barter item that also carries the meds type (LEDX/Ophthalmoscope/Defib)", () => {
    expect(isBarterOnly({ types: ["barter", "meds"] })).toBe(true);
  });

  it("excludes a barter-tagged item that also carries an equipment/weapon/ammo/key type", () => {
    expect(isBarterOnly({ types: ["barter", "rig"] })).toBe(false);
    expect(isBarterOnly({ types: ["barter", "gun"] })).toBe(false);
    expect(isBarterOnly({ types: ["barter", "ammo"] })).toBe(false);
    expect(isBarterOnly({ types: ["barter", "keys"] })).toBe(false);
  });
});

describe("isDogtag", () => {
  it("returns false for null/undefined", () => {
    expect(isDogtag(null)).toBe(false);
    expect(isDogtag(undefined)).toBe(false);
  });

  it("matches any dogtag name, case-insensitively", () => {
    expect(isDogtag({ name: "Dogtag Killa" })).toBe(true);
    expect(isDogtag({ name: "DOGTAG BEAR LVL 15+" })).toBe(true);
  });

  it("returns false for an ordinary item", () => {
    expect(isDogtag({ name: "LEDX Skin Transilluminator" })).toBe(false);
  });
});
