import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { MapRecommendationDialog } from "./MapRecommendationDialog";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
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
    ...overrides,
  };
}

function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [],
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
});

describe("MapRecommendationDialog", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("recommends the map with the most currently-available tasks", async () => {
    const customsA = makeTask({
      id: "customs-a",
      name: "Customs A",
      map: { name: "Customs", normalizedName: "customs" },
    });
    const customsB = makeTask({
      id: "customs-b",
      name: "Customs B",
      map: { name: "Customs", normalizedName: "customs" },
    });
    const woods = makeTask({
      id: "woods-a",
      name: "Woods A",
      map: { name: "Woods", normalizedName: "woods" },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [customsA, customsB, woods] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("2 available tasks")).toBeInTheDocument();
    });
  });

  it("excludes Lightkeeper tasks unless the toggle is checked", async () => {
    const user = userEvent.setup();
    const lightkeeperTask = makeTask({
      id: "lk-1",
      name: "Lightkeeper Task",
      map: { name: "Lighthouse", normalizedName: "lighthouse" },
      lightkeeperRequired: true,
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [lightkeeperTask] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no tasks match these filters/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Include Lightkeeper tasks"));
    await waitFor(() => {
      expect(screen.getByText("1 available task")).toBeInTheDocument();
    });
  });

  it("restricts to Kappa-required tasks when Kappa only is checked", async () => {
    const user = userEvent.setup();
    const normalTask = makeTask({
      id: "normal",
      name: "Normal Task",
      map: { name: "Customs", normalizedName: "customs" },
      kappaRequired: false,
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [normalTask] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("1 available task")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Kappa only"));
    await waitFor(() => {
      expect(screen.getByText(/no tasks match these filters/i)).toBeInTheDocument();
    });
  });
});
