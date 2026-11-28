import { describe, expect, it } from "vitest";

import { blockedFieldMessage, containsBlockedText, findBlockedPresetText } from "./moderation";
import { parsePreset } from "./preset-schema";

import type { Preset } from "../types";

/** Slurs are written reversed (plain ASCII), so the repo never carries them in plain text. */
function unreversed(text: string): string {
  return text.split("").reverse().join("");
}

function preset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: "p1",
    name: "Bolt-action specialist",
    description: "No body armor, armored rigs allowed.",
    rules: [
      { id: "r1", kind: "ban", target: { type: "category", id: "body-armor" } },
      {
        id: "r2",
        kind: "cap",
        target: { type: "item", id: "morphine" },
        max: 1,
        note: "One injector only",
      },
    ],
    ...overrides,
  };
}

describe("containsBlockedText", () => {
  it("rejects a slur", () => {
    expect(containsBlockedText(unreversed("reggin"))).toBe(true);
    expect(containsBlockedText(`Team ${unreversed("gaf")}`)).toBe(true);
  });

  it("rejects ordinary profanity", () => {
    expect(containsBlockedText("what the fuck")).toBe(true);
    expect(containsBlockedText("Shitty loadout")).toBe(true);
  });

  it("catches leetspeak and look-alike letters", () => {
    for (const text of [
      "fvck",
      "sh1t",
      "5h1t",
      "f\u00fcck",
      "\uff46\uff55\uff43\uff4b",
      "\u0455hit",
    ]) {
      expect(containsBlockedText(text), text).toBe(true);
    }
  });

  it("catches spaced-out letters", () => {
    for (const text of ["f u c k", "f.u.c.k", "f-u-c-k", "f_u_c_k", "no f u c k i n g stims"]) {
      expect(containsBlockedText(text), text).toBe(true);
    }
  });

  it("catches words split with invisible or combining characters", () => {
    for (const text of [
      "f\u200buck",
      "fu\u00adck",
      "sh\u2060it",
      "f\u0336u\u0336c\u0336k\u0336",
      "s\u0307h\u0323i\u0301t",
    ]) {
      expect(containsBlockedText(text), JSON.stringify(text)).toBe(true);
    }
  });

  it("passes ordinary Tarkov text", () => {
    const ordinary = [
      "Analgin painkillers",
      "The Therapist",
      "Assault rifles and assault carbines",
      "Titanium plates",
      "Cumulative damage",
      "Ammo penetration 40 or lower",
      "Scav kills",
      "Kappa container",
      "T H I C C item case",
      "No class 5 or 6 armor",
      "Shoreline, Lighthouse, Streets of Tarkov",
      "Sanitar, Shturman, Tagilla, Kaban, Kollontay",
      "Glass, mass, pass, class",
      "Cocktail of stims",
      "Scattershot",
      "Bass",
      "Grape",
      "Arsenal",
    ];
    for (const text of ordinary) expect(containsBlockedText(text), text).toBe(false);
  });

  it("catches words masked with asterisks", () => {
    for (const text of ["f**k", "sh*t", "no b*tch stims", unreversed("regg*n")]) {
      expect(containsBlockedText(text), text).toBe(true);
    }
  });

  it("passes asterisks that mask nothing blocked", () => {
    for (const text of ["5* rated kit", "Rated 4*", "B*ss", "**Important**", "M4A1*"]) {
      expect(containsBlockedText(text), text).toBe(false);
    }
  });

  it("treats line breaks and tabs as word breaks", () => {
    const newline = String.fromCharCode(10);
    const tab = String.fromCharCode(9);
    expect(containsBlockedText(`No stims${newline}Hit and run allowed`)).toBe(false);
    expect(containsBlockedText(`No stims${tab}Hit and run allowed`)).toBe(false);
    expect(containsBlockedText(`Clean line${newline}sh1t`)).toBe(true);
  });

  it("passes empty and whitespace-only input", () => {
    expect(containsBlockedText("")).toBe(false);
    expect(containsBlockedText("   ")).toBe(false);
  });
});

describe("findBlockedPresetText", () => {
  it("passes a clean preset", () => {
    expect(findBlockedPresetText(preset())).toBeNull();
  });

  it("names the field that failed", () => {
    expect(findBlockedPresetText(preset({ name: "sh1t kit" }))).toEqual({ field: "name" });
    expect(findBlockedPresetText(preset({ description: "f u c k armor" }))).toEqual({
      field: "description",
    });
  });

  it("checks every rule note", () => {
    const rules = preset().rules.map((rule) =>
      rule.id === "r2" ? { ...rule, note: `${unreversed("reggin")} only` } : rule,
    );
    expect(findBlockedPresetText(preset({ rules }))).toEqual({ field: "note", ruleId: "r2" });
  });

  it("checks text the way parsePreset stores it, with line breaks kept as word breaks", () => {
    const newline = String.fromCharCode(10);
    const parsed = parsePreset(preset({ description: `No stims${newline}Hit and run allowed` }));
    expect(parsed).not.toBeNull();
    if (parsed) expect(findBlockedPresetText(parsed)).toBeNull();
  });

  it("stops unmasking asterisks once the preset's shared budget is spent (the cost bound)", () => {
    const decoys = "ab*c de*f gh*i jk*l mn*o pq*r st*u vw*x";
    const rules = preset().rules.map((rule) =>
      rule.id === "r2" ? { ...rule, note: "sh*t" } : rule,
    );
    expect(findBlockedPresetText(preset({ description: decoys, rules }))).toBeNull();
    expect(findBlockedPresetText(preset({ rules }))).toEqual({ field: "note", ruleId: "r2" });
  });

  it("explains which field to change", () => {
    expect(blockedFieldMessage({ field: "note", ruleId: "r2" })).toMatch(/^A rule's note has/);
  });
});
