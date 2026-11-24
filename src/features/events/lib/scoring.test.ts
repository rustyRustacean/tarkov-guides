import { describe, expect, it } from "vitest";

import { entryIdFor, type EventDocument, type RaidEntry, type Team } from "../types";

import { defaultSettings, emptyEventDocument } from "./defaults";
import { buildLeaderboards, rankRows, scoreEntry, type LeaderboardRow } from "./scoring";

import type { ProfileMode } from "@/features/progress-tracker/types";

/**
 * Every Raid Log row from the organizer's real event spreadsheet (team
 * names anonymized): team, raid, PMC kills, dogtags, rogue/guard kills, boss
 * kills, players survived, and the points the sheet computed for the row.
 */
const SHEET_ROWS: readonly [string, number, number, number, number, number, number, number][] = [
  ["T1", 1, 2, 0, 1, 0, 1, 18],
  ["T2", 1, 2, 2, 3, 1, 1, 33],
  ["T3", 1, 0, 0, 5, 2, 2, 39],
  ["T4", 1, 4, 4, 6, 3, 2, 73],
  ["T5", 1, 0, 0, 10, 1, 1, 42],
  ["T6", 1, 0, 0, 5, 1, 1, 27],
  ["T7", 1, 0, 0, 3, 1, 2, 26],
  ["T8", 1, 0, 0, 5, 1, 1, 27],
  ["T9", 1, 0, 0, 6, 0, 2, 28],
  ["T3", 2, 0, 0, 3, 0, 0, 9],
  ["T1", 2, 0, 0, 5, 1, 0, 22],
  ["T7", 2, 3, 4, 1, 1, 1, 34],
  ["T10", 1, 2, 0, 3, 1, 1, 31],
  ["T8", 2, 0, 0, 2, 1, 0, 13],
  ["T5", 2, 0, 0, 3, 3, 0, 30],
  ["T2", 2, 1, 1, 11, 1, 2, 56],
  ["T6", 2, 0, 0, 9, 1, 1, 39],
  ["T4", 2, 2, 3, 10, 3, 1, 69],
  ["T1", 3, 1, 2, 7, 4, 2, 66],
  ["T10", 2, 2, 4, 4, 1, 1, 38],
  ["T7", 3, 1, 1, 3, 1, 2, 32],
  ["T3", 3, 1, 4, 10, 1, 2, 56],
  ["T9", 2, 7, 8, 11, 1, 2, 93],
  ["T8", 3, 0, 0, 3, 1, 2, 26],
  ["T4", 3, 2, 2, 10, 3, 2, 73],
  ["T2", 3, 0, 2, 10, 0, 2, 42],
  ["T6", 3, 3, 2, 4, 4, 1, 62],
  ["T5", 3, 0, 0, 5, 0, 1, 20],
  ["T9", 3, 0, 0, 3, 1, 0, 16],
  ["T10", 3, 2, 0, 5, 1, 1, 37],
];

function team(id: string, order = 0): Team {
  return { id, name: id, order, players: [] };
}

function entry(
  teamId: string,
  raid: number,
  counts: Record<string, number>,
  mode: ProfileMode = "PVP",
): RaidEntry {
  return {
    id: entryIdFor(teamId, mode, raid),
    teamId,
    mode,
    raid,
    counts,
    note: "",
    updatedAt: 1,
  };
}

function sheetDocument(): EventDocument {
  const doc = emptyEventDocument({ ...defaultSettings("Sheet", ["PVP"], 2), tiebreakers: [] });
  const ids = [...new Set(SHEET_ROWS.map(([id]) => id))];
  ids.forEach((id, i) => (doc.teams[id] = team(id, i)));
  for (const [teamId, raid, pmc, tags, rogue, boss, survived] of SHEET_ROWS) {
    const e = entry(teamId, raid, {
      pmcKills: pmc,
      dogtags: tags,
      rogueGuardKills: rogue,
      bossKills: boss,
      survived,
    });
    doc.entries[e.id] = e;
  }
  return doc;
}

describe("scoreEntry", () => {
  it("matches the spreadsheet for every logged row", () => {
    const doc = sheetDocument();
    for (const [teamId, raid, , , , , , expected] of SHEET_ROWS) {
      const e = doc.entries[entryIdFor(teamId, "PVP", raid)];
      if (!e) throw new Error("missing entry");
      expect(scoreEntry(e, doc.columns, doc.settings).total).toBe(expected);
    }
  });

  it("scores the spreadsheet's own example row as 25", () => {
    const doc = sheetDocument();
    const example = entry("T5", 1, {
      pmcKills: 2,
      dogtags: 2,
      rogueGuardKills: 1,
      bossKills: 0,
      survived: 2,
    });
    expect(scoreEntry(example, doc.columns, doc.settings).total).toBe(25);
  });

  it("caps players survived at the team size", () => {
    const doc = sheetDocument();
    const e = entry("T1", 1, { survived: 4 });
    expect(scoreEntry(e, doc.columns, doc.settings).total).toBe(10);
  });

  it("ignores disabled columns and applies raid multipliers", () => {
    const doc = sheetDocument();
    doc.settings.raidMultipliers = { PVP: { "3": 2 } };
    doc.columns = doc.columns.map((c) => (c.id === "dogtags" ? { ...c, enabled: false } : c));
    const e = entry("T1", 3, { pmcKills: 1, dogtags: 5 });
    expect(scoreEntry(e, doc.columns, doc.settings)).toMatchObject({
      base: 5,
      multiplier: 2,
      total: 10,
    });
  });

  it("uses per-mode points when scoring per mode, falling back to the shared value", () => {
    const doc = emptyEventDocument({ ...defaultSettings("Modes", ["PVP", "PVE"]) });
    doc.settings.scoringPerMode = true;
    doc.columns = doc.columns.map((c) =>
      c.id === "pmcKills" ? { ...c, points: { all: 5, PVE: 1 } } : c,
    );
    expect(scoreEntry(entry("A", 1, { pmcKills: 3 }, "PVE"), doc.columns, doc.settings).total).toBe(
      3,
    );
    expect(scoreEntry(entry("A", 1, { pmcKills: 3 }, "PVP"), doc.columns, doc.settings).total).toBe(
      15,
    );
  });

  it("subtracts penalty columns", () => {
    const doc = sheetDocument();
    doc.columns.push({
      id: "rulebreak",
      kind: "penalty",
      label: "Rule break",
      points: { all: -10 },
      enabled: true,
    });
    const e = entry("T1", 1, { pmcKills: 1, rulebreak: 1 });
    expect(scoreEntry(e, doc.columns, doc.settings).total).toBe(-5);
  });
});

describe("buildLeaderboards", () => {
  it("reproduces the spreadsheet's leaderboard, ties sharing a place", () => {
    const { boards } = buildLeaderboards(sheetDocument());
    expect(boards).toHaveLength(1);
    const rows = boards[0]?.rows ?? [];
    expect(rows.map((r) => [r.team.id, r.total, r.place])).toEqual([
      ["T4", 215, 1],
      ["T9", 137, 2],
      ["T2", 131, 3],
      ["T6", 128, 4],
      ["T1", 106, 5],
      ["T10", 106, 5],
      ["T3", 104, 7],
      ["T5", 92, 8],
      ["T7", 92, 8],
      ["T8", 66, 10],
    ]);
    expect(rows[0]?.raidTotals.PVP).toEqual([73, 69, 73]);
    expect(rows[0]?.columnTotals.pmcKills).toBe(8);
  });

  it("breaks ties with tiebreaker columns in order", () => {
    const doc = sheetDocument();
    doc.settings.tiebreakers = ["survived", "pmcKills"];
    const rows = buildLeaderboards(doc).boards[0]?.rows ?? [];
    const tied = rows.filter((r) => r.total === 106);
    // T1 survived 3, T10 survived 3; T1 has 3 PMC kills, T10 has 6.
    expect(tied.map((r) => [r.team.id, r.place])).toEqual([
      ["T10", 5],
      ["T1", 6],
    ]);
  });

  it("counts only the best N raids per mode", () => {
    const doc = sheetDocument();
    doc.settings.bestRaids = 2;
    const row = buildLeaderboards(doc).boards[0]?.rows.find((r) => r.team.id === "T1");
    // T1 raids: 18, 22, 66. Best two: 66 + 22.
    expect(row?.total).toBe(88);
    expect(row?.raidCounted.PVP).toEqual([false, true, true]);
  });

  it("adds adjustments and lists teams with no raids", () => {
    const doc = sheetDocument();
    doc.teams.T11 = team("T11", 99);
    doc.adjustments.a = {
      id: "a",
      teamId: "T4",
      mode: null,
      points: -15,
      reason: "Late",
      createdAt: 1,
    };
    const rows = buildLeaderboards(doc).boards[0]?.rows ?? [];
    expect(rows.find((r) => r.team.id === "T4")).toMatchObject({
      total: 200,
      adjustmentPoints: -15,
    });
    expect(rows.find((r) => r.team.id === "T11")).toMatchObject({ total: 0, raidsLogged: 0 });
  });

  it("ranks modes separately when asked, with event-wide adjustments flagged", () => {
    const doc = emptyEventDocument(defaultSettings("Split", ["PVP", "PVE"]));
    doc.settings.leaderboard = "separate";
    doc.teams.A = team("A", 0);
    doc.teams.B = team("B", 1);
    for (const e of [
      entry("A", 1, { pmcKills: 2 }, "PVP"),
      entry("B", 1, { pmcKills: 1 }, "PVP"),
      entry("B", 1, { pmcKills: 5 }, "PVE"),
    ]) {
      doc.entries[e.id] = e;
    }
    doc.adjustments.x = { id: "x", teamId: "A", mode: null, points: 3, reason: "", createdAt: 1 };
    doc.adjustments.y = { id: "y", teamId: "A", mode: "PVE", points: 1, reason: "", createdAt: 1 };

    const { boards, notes } = buildLeaderboards(doc);
    expect(boards.map((b) => b.id)).toEqual(["PVP", "PVE"]);
    expect(boards[0]?.rows.map((r) => [r.team.id, r.total])).toEqual([
      ["A", 10],
      ["B", 5],
    ]);
    expect(boards[1]?.rows.map((r) => [r.team.id, r.total])).toEqual([
      ["B", 25],
      ["A", 1],
    ]);
    expect(notes.unassignedAdjustmentIds).toEqual(["x"]);
  });

  it("combines modes into one board by default", () => {
    const doc = emptyEventDocument(defaultSettings("Both", ["PVP", "PVE"]));
    doc.teams.A = team("A");
    for (const e of [
      entry("A", 1, { pmcKills: 1 }, "PVP"),
      entry("A", 1, { pmcKills: 1 }, "PVE"),
    ]) {
      doc.entries[e.id] = e;
    }
    const { boards } = buildLeaderboards(doc);
    expect(boards).toHaveLength(1);
    expect(boards[0]?.rows[0]).toMatchObject({ total: 10, modeTotals: { PVP: 5, PVE: 5 } });
  });

  it("leaves raids past the mode's raid count out of the score", () => {
    const doc = sheetDocument();
    doc.settings.raidsPerMode = { PVP: 2 };
    const { boards, notes } = buildLeaderboards(doc);
    expect(boards[0]?.rows.find((r) => r.team.id === "T4")?.total).toBe(142);
    expect(notes.outOfRangeEntryIds).toHaveLength(10);
  });
});

describe("rankRows", () => {
  it("gives equal rows the same place and skips the next", () => {
    const base = { raidPoints: 0, adjustmentPoints: 0, raidsLogged: 0 } as const;
    const make = (id: string, total: number): LeaderboardRow => ({
      ...base,
      team: team(id),
      place: 0,
      total,
      raidTotals: {},
      raidCounted: {},
      modeTotals: {},
      columnTotals: {},
    });
    const ranked = rankRows([make("c", 5), make("a", 9), make("b", 9)], []);
    expect(ranked.map((r) => [r.team.id, r.place])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ]);
  });
});
