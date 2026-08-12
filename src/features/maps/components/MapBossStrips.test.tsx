import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { MapBossStrips } from "./MapBossStrips";

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
  return {
    name,
    normalizedName: name.toLowerCase().replace(/\s+/g, "-"),
    imagePortraitLink: null,
    spawnChance,
  };
}

function makeMap(overrides: Partial<RawMap> = {}): RawMap {
  return {
    name: "Reserve",
    normalizedName: "reserve",
    nameId: null,
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

describe("MapBossStrips", () => {
  it("renders the merged boss pills once data loads", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({
        maps: [
          makeMap({
            bosses: [boss("Gluhar", 0.3), boss("Cultist Priest", 0.2)],
          }),
        ],
      }),
    );
    renderWithQueryClient(<MapBossStrips normalizedName="reserve" />);

    expect(await screen.findByText("Gluhar")).toBeInTheDocument();
    expect(screen.getByText("Cultists")).toBeInTheDocument();
  });

  it("renders nothing for an unknown map (no bosses to show)", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { container } = renderWithQueryClient(<MapBossStrips normalizedName="not-a-real-map" />);
    await vi.waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a map has no bosses", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ maps: [makeMap({ raidDuration: null, players: null, bosses: [] })] }),
    );
    const { container } = renderWithQueryClient(<MapBossStrips normalizedName="reserve" />);

    await vi.waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
