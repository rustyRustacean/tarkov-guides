import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestAnalyticsPanel } from "./QuestAnalyticsPanel";

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
    tasksPve: [],
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

describe("QuestAnalyticsPanel", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<QuestAnalyticsPanel />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("computes real completion stats and per-trader breakdown from live data + profile state", async () => {
    const done = makeTask({
      id: "done",
      name: "Done Quest",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const notStarted = makeTask({
      id: "not-started",
      name: "Not Started Quest",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [done, notStarted] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ done: { status: "done" } });

    renderWithQueryClient(<QuestAnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    // "Prapor" now appears twice - once in the "Progress by trader" list,
    // once in the new pie chart's legend - so assert the count rather than
    // a single unique match.
    expect(screen.getAllByText("Prapor")).toHaveLength(2);
    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.taskStatus.done
        ?.status,
    ).toBe("done");
  });

  it("shows Kappa item and task progress scoped to the Collector task", async () => {
    const collector = makeTask({
      id: "collector",
      name: "Collector",
      kappaRequired: true,
      objectives: [
        {
          id: "obj-1",
          type: "giveItem",
          description: "Hand over Bitcoin",
          optional: false,
          maps: [],
          item: { id: "item-1", name: "Bitcoin", shortName: "BTC", iconLink: null },
          count: 1,
          foundInRaid: false,
        },
      ],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [collector] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestAnalyticsPanel />);

    await waitFor(() => {
      // The Kappa item checklist, the Kappa-required task count, AND the
      // (trader-less, so "Unknown") per-trader row are all 0-of-1 for this
      // single-task fixture.
      expect(screen.getAllByText("0/1")).toHaveLength(3);
    });
  });
});
