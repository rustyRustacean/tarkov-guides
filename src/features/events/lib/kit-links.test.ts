import { describe, expect, it } from "vitest";

import { eventKitPath, kitFromHash, kitHash, presetFromHash } from "./kit-links";

import type { Kit, Preset } from "../types";

const KIT: Kit = {
  slots: { primary: { itemId: "m700", attachments: ["scope"], ammo: { itemId: "m80", qty: 20 } } },
  carried: [{ itemId: "morphine", qty: 1 }],
};
const PRESET: Preset = {
  id: "bolt",
  name: "Bolt-action specialist",
  description: "",
  rules: [{ id: "r1", kind: "ban", target: { type: "category", id: "armor" } }],
};

describe("kit links", () => {
  it("round-trips a kit and a standalone preset through the fragment", async () => {
    const hash = await kitHash(KIT, PRESET);
    expect(hash).toMatch(/^#p=1\.[\w-]+&k=1\.[\w-]+$/);
    expect(await kitFromHash(hash)).toEqual(KIT);
    expect(await presetFromHash(hash)).toEqual(PRESET);
  });

  it("leaves an empty kit out of the link", async () => {
    expect(await kitHash({ slots: {}, carried: [] })).toBe("");
  });

  it("returns null for a missing or broken fragment", async () => {
    expect(await kitFromHash("")).toBeNull();
    expect(await kitFromHash("#k=1.garbage")).toBeNull();
    expect(await presetFromHash("#p=nope")).toBeNull();
  });

  it("builds the event kit path with the role", () => {
    expect(eventKitPath("abcdefghjk", "role1")).toBe("/resources/events/abcdefghjk/kit?role=role1");
  });
});
