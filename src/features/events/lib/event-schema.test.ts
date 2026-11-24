import { describe, expect, it } from "vitest";

import { defaultSettings, emptyEventDocument } from "./defaults";
import { cleanText, parseEventDocument, parseSettings } from "./event-schema";

/** Zero-width space and right-to-left override, written as codes because they are invisible. */
const ZWSP = String.fromCharCode(0x200b);
const RLO = String.fromCharCode(0x202e);

describe("cleanText", () => {
  it("strips control, zero-width and bidi characters, trims and caps length", () => {
    expect(cleanText(`  Te${ZWSP}am${RLO}\u0007 `, 40)).toBe("Team");
    expect(cleanText("abcdef", 3)).toBe("abc");
    expect(cleanText(42, 10)).toBe("");
  });
});

describe("parseSettings", () => {
  it("rejects settings with no name or no valid mode", () => {
    expect(parseSettings({ ...defaultSettings("x"), name: "   " })).toBeNull();
    expect(parseSettings({ ...defaultSettings("x"), modes: ["ARENA"] })).toBeNull();
  });

  it("orders and dedupes modes, and fills defaults for bad numbers", () => {
    const settings = parseSettings({
      ...defaultSettings("Cup"),
      modes: ["PVE", "PVP", "PVE"],
      teamSize: 9,
      raidsPerMode: { PVP: 500 },
      bestRaids: 0,
      raidMultipliers: { PVP: { "2": 2, "3": 1, x: 4 }, PVE: { "1": 99 } },
    });
    expect(settings).toMatchObject({
      modes: ["PVP", "PVE"],
      teamSize: 2,
      raidsPerMode: { PVP: 3, PVE: 3 },
      bestRaids: null,
      raidMultipliers: { PVP: { "2": 2 } },
    });
  });
});

describe("parseEventDocument", () => {
  it("keeps valid parts and drops malformed ones instead of rejecting the event", () => {
    const doc = emptyEventDocument(defaultSettings("Cup", ["PVP"], 2));
    const raw = {
      ...doc,
      columns: [...doc.columns, { id: "bad id!", kind: "custom", label: "x", points: {} }],
      teams: new Map<string, unknown>([
        [
          "a",
          {
            id: "a",
            name: "Alpha",
            order: 0,
            players: [1, 2, 3].map((n) => ({
              id: `p${String(n)}`,
              name: `P${String(n)}`,
              roleId: null,
            })),
          },
        ],
        ["b", { id: "b", name: "" }],
      ]),
      entries: {
        one: {
          teamId: "a",
          mode: "PVP",
          raid: 1,
          counts: { pmcKills: 2, dogtags: -1 },
          updatedAt: 5,
        },
        stale: {
          id: "whatever",
          teamId: "a",
          mode: "PVP",
          raid: 1,
          counts: { pmcKills: 9 },
          updatedAt: 1,
        },
        ghost: { teamId: "zzz", mode: "PVP", raid: 1, counts: {} },
        wrongMode: { teamId: "a", mode: "PVE", raid: 1, counts: {} },
      },
    };
    const parsed = parseEventDocument(raw);
    expect(parsed?.columns).toHaveLength(doc.columns.length);
    expect(Object.keys(parsed?.teams ?? {})).toEqual(["a"]);
    // Roster capped at the duo team size.
    expect(parsed?.teams.a?.players).toHaveLength(2);
    // Two entries for the same team/mode/raid collapse into the newer one, re-keyed.
    expect(parsed?.entries).toEqual({
      "a:PVP:1": {
        id: "a:PVP:1",
        teamId: "a",
        mode: "PVP",
        raid: 1,
        counts: { pmcKills: 2 },
        note: "",
        updatedAt: 5,
      },
    });
  });

  it("rejects anything without usable settings", () => {
    expect(parseEventDocument(null)).toBeNull();
    expect(parseEventDocument({ settings: null })).toBeNull();
  });
});
