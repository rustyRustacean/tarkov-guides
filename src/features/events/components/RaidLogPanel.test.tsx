import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultSettings, emptyEventDocument } from "../lib/defaults";
import { entryIdFor, type EventDocument } from "../types";

import { RaidLogPanel } from "./RaidLogPanel";

import type { EventEditor } from "../room/use-event-editor";

vi.mock("@/shared/lib/tarkov-api/use-tarkov-indexes", () => ({
  useTarkovIndexes: () => ({ items: { byId: {}, byShortName: {} }, tasksById: new Map() }),
}));

function sampleDoc(): EventDocument {
  const doc = emptyEventDocument(defaultSettings("Cup", ["PVP", "PVE"], 2));
  doc.teams.a = { id: "a", name: "Alpha", order: 0, players: [] };
  doc.teams.b = { id: "b", name: "Bravo", order: 1, players: [] };
  const id = entryIdFor("a", "PVP", 1);
  doc.entries[id] = {
    id,
    teamId: "a",
    mode: "PVP",
    raid: 1,
    counts: { pmcKills: 2 },
    note: "clean raid",
    updatedAt: 1,
  };
  return doc;
}

function mockEditor(): EventEditor {
  return {
    setSettings: vi.fn(),
    setColumns: vi.fn(),
    upsertTeam: vi.fn(),
    deleteTeam: vi.fn(),
    setCount: vi.fn(),
    setNote: vi.fn(),
    clearEntry: vi.fn(),
    addAdjustment: vi.fn(),
    deleteAdjustment: vi.fn(),
    upsertPreset: vi.fn(),
    deletePreset: vi.fn(),
  };
}

describe("RaidLogPanel", () => {
  it("shows the selected raid's counts and points read-only for viewers", () => {
    render(<RaidLogPanel doc={sampleDoc()} />);
    expect(screen.getByText("1 of 2 teams logged")).toBeInTheDocument();
    expect(screen.getByText("clean raid")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Increase/ })).not.toBeInTheDocument();
  });

  it("writes a count for the chosen mode and raid when an editor steps it", () => {
    const editor = mockEditor();
    render(<RaidLogPanel doc={sampleDoc()} editor={editor} />);
    fireEvent.click(screen.getByRole("radio", { name: "PvE" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Bravo PMC kills" }));
    expect(editor.setCount).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "PVE", raid: 2, count: 1 }),
    );
  });

  it("caps players survived at the team size", () => {
    const doc = sampleDoc();
    const id = entryIdFor("a", "PVP", 1);
    const entry = doc.entries[id];
    if (entry) entry.counts.survived = 2;
    render(<RaidLogPanel doc={doc} editor={mockEditor()} />);
    expect(screen.getByRole("button", { name: "Increase Alpha Players survived" })).toBeDisabled();
  });
});
