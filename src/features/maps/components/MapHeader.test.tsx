import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { MapHeader } from "./MapHeader";

import type {
  RawMap,
  RawMapBoss,
  RawTarkovApiResponseData,
  RawTask,
} from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

function boss(name: string, spawnChance: number): RawMapBoss {
  return { name, spawnChance, spawnLocations: [] };
}

function makeMap(overrides: Partial<RawMap> = {}): RawMap {
  return {
    name: "Reserve",
    normalizedName: "reserve",
    raidDuration: 45,
    players: "8-12",
    bosses: [],
    ...overrides,
  };
}

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
    tasks: [makeTask()],
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

describe("MapHeader", () => {
  it("renders raid times and day/night boss pills once data loads", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({
        maps: [
          makeMap({
            bosses: [boss("Gluhar", 0.3), boss("Cultist Priest", 0.2)],
          }),
        ],
      }),
    );
    renderWithQueryClient(<MapHeader normalizedName="reserve" />);

    expect(await screen.findByText("45m")).toBeInTheDocument();
    expect(screen.getByText("38m")).toBeInTheDocument();
    expect(screen.getByText("Gluhar")).toBeInTheDocument();
    expect(screen.getByText("Cultists")).toBeInTheDocument();
  });

  it("renders without crashing for an unknown map", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapHeader normalizedName="not-a-real-map" />);
    expect(await screen.findByText("L")).toBeInTheDocument();
  });
});
