import { describe, expect, it } from "vitest";

import { findItemLocationEntry, type ItemLocationEntry } from "./find-item-location-entry";

import type { ResolvableGameItem } from "./resolve-game-item";

const ledxEntry: ItemLocationEntry = {
  match: ["ledx"],
  general: "Medbags + pharmacy spawns only. Extremely rare.",
  perMap: { customs: "New gas station medical", reserve: "D-2 medical" },
};
const locations: Readonly<Record<string, ItemLocationEntry>> = { ledx: ledxEntry };

describe("findItemLocationEntry", () => {
  it("resolves via the shortName key first", () => {
    const item: ResolvableGameItem = { shortName: "LEDX", name: "LEDX Skin Transilluminator" };
    expect(findItemLocationEntry(item, locations)).toEqual({ key: "ledx", entry: ledxEntry });
  });

  it("falls back to substring-matching the name against every entry's match array", () => {
    // shortName doesn't hit the 'ledx' key directly, but the name contains 'ledx'.
    const item: ResolvableGameItem = {
      shortName: "Transilluminator",
      name: "LEDX Skin Transilluminator",
    };
    expect(findItemLocationEntry(item, locations)).toEqual({ key: "ledx", entry: ledxEntry });
  });

  it("returns undefined on a total miss", () => {
    const item: ResolvableGameItem = { shortName: "Nope", name: "Something unrelated" };
    expect(findItemLocationEntry(item, locations)).toBeUndefined();
  });
});
