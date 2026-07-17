import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestRecommendations } from "./QuestRecommendations";

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

describe("QuestRecommendations", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<QuestRecommendations />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("shows a no-quests-available message when nothing is available", async () => {
    const locked = makeTask({
      id: "locked",
      name: "Locked Quest",
      minPlayerLevel: 50,
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [locked] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestRecommendations />);
    await waitFor(() => {
      expect(screen.getByText(/no quests are currently available/i)).toBeInTheDocument();
    });
  });

  it("ranks a Kappa-required, high-XP quest above a plain low-XP quest", async () => {
    const kappaTask = makeTask({
      id: "kappa-task",
      name: "Kappa Quest",
      kappaRequired: true,
      experience: 15_000,
    });
    const plainTask = makeTask({ id: "plain-task", name: "Plain Quest", experience: 100 });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [plainTask, kappaTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestRecommendations />);
    await waitFor(() => {
      expect(screen.getByText("Kappa Quest")).toBeInTheDocument();
    });

    const items = screen.getAllByText(/Quest$/);
    expect(items[0]).toHaveTextContent("Kappa Quest");
    expect(screen.getByText("Kappa required")).toBeInTheDocument();
    expect(screen.getByText("High XP reward")).toBeInTheDocument();
  });

  it("opens the quest detail dialog when a recommendation is clicked", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestRecommendations />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Debut"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
