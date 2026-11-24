import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { defaultSettings, emptyEventDocument } from "../lib/defaults";
import { entryIdFor, type EventDocument, type RaidEntry } from "../types";

import { LeaderboardPanel } from "./LeaderboardPanel";

import type { ProfileMode } from "@/features/progress-tracker/types";

function entry(teamId: string, mode: ProfileMode, pmcKills: number): RaidEntry {
  const id = entryIdFor(teamId, mode, 1);
  return { id, teamId, mode, raid: 1, counts: { pmcKills }, note: "", updatedAt: 1 };
}

function splitDoc(): EventDocument {
  const doc = emptyEventDocument(defaultSettings("Cup", ["PVP", "PVE"], 2));
  doc.settings.leaderboard = "separate";
  doc.teams.a = { id: "a", name: "Alpha", order: 0, players: [] };
  doc.teams.b = { id: "b", name: "Bravo", order: 1, players: [] };
  for (const e of [entry("a", "PVP", 3), entry("b", "PVP", 1), entry("b", "PVE", 9)]) {
    doc.entries[e.id] = e;
  }
  return doc;
}

function rowTeams(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("rowheader")
    .map((cell) => cell.textContent);
}

describe("LeaderboardPanel", () => {
  it("ranks each mode on its own board when modes are separate", () => {
    render(<LeaderboardPanel doc={splitDoc()} />);
    expect(screen.getByRole("table", { name: "PvP leaderboard" })).toBeInTheDocument();
    expect(rowTeams()).toEqual(["Alpha", "Bravo"]);
    fireEvent.click(screen.getByRole("radio", { name: "PvE" }));
    expect(screen.getByRole("table", { name: "PvE leaderboard" })).toBeInTheDocument();
    expect(rowTeams()).toEqual(["Bravo", "Alpha"]);
  });

  it("shows one combined board with points per mode by default", () => {
    const doc = splitDoc();
    doc.settings.leaderboard = "combined";
    render(<LeaderboardPanel doc={doc} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "PvE" })).toBeInTheDocument();
    expect(rowTeams()).toEqual(["Bravo", "Alpha"]);
  });
});
