import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { KappaTracker } from "./KappaTracker";

import type {
  RawHideoutStation,
  RawTarkovApiResponseData,
  RawTask,
} from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeFindObjective(itemId: string, count: number, name = itemId) {
  return {
    id: `obj-${itemId}`,
    type: "findItem",
    description: `Find ${String(count)} in raid`,
    optional: false,
    maps: [],
    item: { id: itemId, name, shortName: name, iconLink: null },
    count,
    foundInRaid: true,
  };
}

function makeCollectorTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
    id: "collector",
    name: "Collector",
    kappaRequired: true,
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
    objectives: [makeFindObjective("quest-item-a", 1, "Bitcoin")],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
    ...overrides,
  };
}

function makeStation(overrides: Partial<RawHideoutStation> = {}): RawHideoutStation {
  return {
    id: "station-1",
    name: "Workbench",
    normalizedName: "workbench",
    levels: [
      {
        level: 1,
        itemRequirements: [
          {
            item: { id: "hideout-item-a", name: "Bolts", shortName: "Bolts", iconLink: null },
            count: 5,
          },
        ],
        stationLevelRequirements: [],
      },
    ],
    ...overrides,
  };
}

function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [makeCollectorTask()],
    tasksPve: [],
    hideoutStations: [makeStation()],
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

describe("KappaTracker", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<KappaTracker />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("renders Collector items under Quest items and hideout items under Hideout items", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<KappaTracker />);
    await waitFor(() => {
      expect(screen.getByText("Bolts")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: /Quest items/ }));
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
  });

  it("switches between Cards and Table view", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<KappaTracker />);
    await waitFor(() => {
      expect(screen.getByText("Bolts")).toBeInTheDocument();
    });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("checking an item off in one tab also marks it got in the other tab (shared keyspace)", async () => {
    const sharedId = "shared-item";
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({
        tasks: [makeCollectorTask({ objectives: [makeFindObjective(sharedId, 1, "Duct Tape")] })],
        hideoutStations: [
          makeStation({
            levels: [
              {
                level: 1,
                itemRequirements: [
                  {
                    item: {
                      id: sharedId,
                      name: "Duct Tape",
                      shortName: "Duct Tape",
                      iconLink: null,
                    },
                    count: 3,
                  },
                ],
                stationLevelRequirements: [],
              },
            ],
          }),
        ],
      }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<KappaTracker />);
    await waitFor(() => {
      expect(screen.getByText("Duct Tape")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Duct Tape/ }));

    await user.click(screen.getByRole("tab", { name: /Quest items/ }));
    expect(screen.getByRole("button", { name: /Duct Tape/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps a just-toggled item visible with a Securing… badge instead of removing it", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<KappaTracker />);
    await waitFor(() => {
      expect(screen.getByText("Bolts")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Bolts/ }));
    });

    expect(screen.getByText("Securing…")).toBeInTheDocument();
  });
});
