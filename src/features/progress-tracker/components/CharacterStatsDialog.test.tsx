import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { CharacterStatsDialog } from "./CharacterStatsDialog";

import type { RawTarkovApiResponseData } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

/**
 * `useTarkovGameData()` deliberately errors when BOTH `tasks` and `items`
 * come back empty (its own "failed refresh" safety net) - so every fixture
 * here seeds one task to keep the query in a successful state, even though
 * these tests only care about `traders`.
 */
function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [
      {
        id: "task-1",
        name: "Task",
        kappaRequired: false,
        minPlayerLevel: 1,
        experience: 0,
        wikiLink: null,
        factionName: null,
        taskImageLink: null,
        availableDelaySecondsMin: 0,
        availableDelaySecondsMax: 0,
        restartable: false,
        lightkeeperRequired: false,
        requiredPrestige: null,
        trader: { id: "trader-1", name: "Trader", imageLink: null },
        map: null,
        taskRequirements: [],
        traderRequirements: [],
        objectives: [],
        failConditions: [],
        finishRewards: null,
        startRewards: null,
        failureOutcome: null,
      },
    ],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    maps: [],
    traders: [],
    barters: [],
    crafts: [],
    ...overrides,
  };
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
});

describe("CharacterStatsDialog", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    renderWithQueryClient(<CharacterStatsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("shows a loading message before trader data has resolved", () => {
    vi.mocked(fetchTarkovGameData).mockReturnValue(new Promise(() => undefined));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<CharacterStatsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/loading trader data/i)).toBeInTheDocument();
  });

  it("edits player level for the active profile", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<CharacterStatsDialog open onOpenChange={vi.fn()} />);

    // `type="number"` inputs don't play well with userEvent's
    // clear()+type() keystroke simulation in jsdom (typing "25" after an
    // incomplete clear produced "125" rather than "25") - fireEvent.change
    // is the reliable way to set a controlled numeric input's value in tests.
    fireEvent.change(screen.getByLabelText("Player Level"), { target: { value: "25" } });

    const id = useProgressTrackerStore.getState().activeProfileId;
    expect(useProgressTrackerStore.getState().progressByProfile[id ?? ""]?.playerLevel).toBe(25);
  });

  it("clamps player level to a minimum of 1", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<CharacterStatsDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Player Level"), { target: { value: "" } });

    const id = useProgressTrackerStore.getState().activeProfileId;
    expect(useProgressTrackerStore.getState().progressByProfile[id ?? ""]?.playerLevel).toBe(1);
  });

  it("edits prestige level for the active profile, clamped to a minimum of 0", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<CharacterStatsDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Prestige Level"), { target: { value: "2" } });
    const id = useProgressTrackerStore.getState().activeProfileId;
    expect(useProgressTrackerStore.getState().progressByProfile[id ?? ""]?.prestigeLevel).toBe(2);

    fireEvent.change(screen.getByLabelText("Prestige Level"), { target: { value: "-5" } });
    expect(useProgressTrackerStore.getState().progressByProfile[id ?? ""]?.prestigeLevel).toBe(0);
  });

  it("lists every live trader with level and reputation inputs, and edits them", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({
        traders: [{ id: "prapor-id", name: "Prapor", normalizedName: "prapor", imageLink: null }],
      }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<CharacterStatsDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Prapor")).toBeInTheDocument();
    });

    const levelInputs = screen.getAllByLabelText("Level");
    const levelInput = levelInputs[0];
    if (!levelInput) throw new Error("expected a trader level input");
    fireEvent.change(levelInput, { target: { value: "3" } });

    const id = useProgressTrackerStore.getState().activeProfileId;
    expect(useProgressTrackerStore.getState().progressByProfile[id ?? ""]?.traderLevels).toEqual({
      "prapor-id": 3,
    });

    const repInputs = screen.getAllByLabelText("Rep");
    const repInput = repInputs[0];
    if (!repInput) throw new Error("expected a trader reputation input");
    fireEvent.change(repInput, { target: { value: "-2" } });

    expect(
      useProgressTrackerStore.getState().progressByProfile[id ?? ""]?.traderReputation,
    ).toEqual({ "prapor-id": -2 });
  });
});
