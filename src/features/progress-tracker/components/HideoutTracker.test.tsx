import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { HideoutTracker } from "./HideoutTracker";

import type {
  RawHideoutStation,
  RawTarkovApiResponseData,
  RawTask,
} from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
    id: "task-1",
    name: "Task",
    kappaRequired: false,
    hasHiddenRequirement: false,
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
    ...overrides,
  };
}

const stationA: RawHideoutStation = {
  id: "station-a",
  name: "Workbench",
  normalizedName: "workbench",
  levels: [
    { level: 1, itemRequirements: [], stationLevelRequirements: [] },
    { level: 2, itemRequirements: [], stationLevelRequirements: [] },
  ],
};

function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [makeTask()],
    tasksPve: [],
    hideoutStations: [stationA],
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
});

describe("HideoutTracker", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<HideoutTracker />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("renders real station/level data", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<HideoutTracker />);
    await waitFor(() => {
      expect(screen.getByText("Workbench")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "L1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "L2" })).toBeInTheDocument();
  });

  it("clicking a level pill toggles build state through the real store", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<HideoutTracker />);
    await waitFor(() => {
      expect(screen.getByText("Workbench")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "L1" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.hideoutBuilt,
    ).toEqual({
      "workbench:1": true,
    });
  });

  it("clicking a locked level's pill still force-builds it, cascading lower levels (the 'catch up' behavior)", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<HideoutTracker />);
    await waitFor(() => {
      expect(screen.getByText("Workbench")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    // L2 is locked (L1 isn't built yet) but must still be clickable.
    await user.click(screen.getByRole("button", { name: "L2" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.hideoutBuilt,
    ).toEqual({
      "workbench:1": true,
      "workbench:2": true,
    });
  });

  it("clicking the star sets the goal and the banner shows the path; CLEAR removes it", async () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());

    renderWithQueryClient(<HideoutTracker />);
    await waitFor(() => {
      expect(screen.getByText("Workbench")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Set goal: Workbench L2/ }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.hideoutGoal,
    ).toEqual({
      stationNormalizedName: "workbench",
      level: 2,
    });
    expect(screen.getByText("Goal: Workbench L2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.hideoutGoal,
    ).toBeNull();
  });
});
