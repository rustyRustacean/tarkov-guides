import { describe, expect, it } from "vitest";

import { entryIdFor } from "../types";

import { defaultSettings, emptyEventDocument } from "./defaults";
import { eventJson, exportFileStem, leaderboardCsv, parseEventImport, raidLogCsv } from "./export";

function sampleDocument() {
  const doc = emptyEventDocument(defaultSettings("Duo Cup", ["PVP"], 2));
  doc.teams.a = { id: "a", name: "=HYPERLINK(evil)", order: 0, players: [] };
  doc.teams.b = { id: "b", name: 'Team "B", Bravo', order: 1, players: [] };
  const id = entryIdFor("a", "PVP", 1);
  doc.entries[id] = {
    id,
    teamId: "a",
    mode: "PVP",
    raid: 1,
    counts: { pmcKills: 2, survived: 2 },
    note: "",
    updatedAt: 1,
  };
  doc.activity = [{ at: 1, by: "Jeff", summary: "Added team" }];
  return doc;
}

describe("raidLogCsv", () => {
  it("writes one row per entry with points, and defuses formula-like team names", () => {
    const lines = raidLogCsv(sampleDocument()).trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "Team,Mode,Raid,PMC kills,Dogtags,Scav kills,Rogue / guard kills,Boss kills,Players survived,Points,Note",
    );
    expect(lines[1]).toBe("'=HYPERLINK(evil),PvP,1,2,0,0,0,0,2,20,");
  });
});

describe("leaderboardCsv", () => {
  it("quotes names with commas and quotes", () => {
    const csv = leaderboardCsv(sampleDocument());
    expect(csv).toContain('"Team ""B"", Bravo"');
    expect(csv.split("\r\n")[1]).toBe("Overall,1,'=HYPERLINK(evil),20,1,20,0");
  });
});

describe("eventJson / parseEventImport", () => {
  it("round-trips a document without its activity log", () => {
    const doc = sampleDocument();
    const imported = parseEventImport(eventJson(doc));
    expect(imported).toEqual({ ...doc, activity: [] });
  });

  it("rejects JSON that isn't an event export", () => {
    expect(parseEventImport("not json")).toBeNull();
    expect(parseEventImport(JSON.stringify({ document: sampleDocument() }))).toBeNull();
    expect(
      parseEventImport(JSON.stringify({ format: "tarkovguides-event", document: {} })),
    ).toBeNull();
  });
});

describe("exportFileStem", () => {
  it("makes a safe file name", () => {
    expect(exportFileStem("Duo Cup: Season 2!")).toBe("duo-cup-season-2");
    expect(exportFileStem("???")).toBe("event");
  });
});
