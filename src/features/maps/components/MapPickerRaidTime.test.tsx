import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { MapPickerRaidTime } from "./MapPickerRaidTime";

import type { RawMap, RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

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

describe("MapPickerRaidTime", () => {
  it("renders raid/extract times once data loads", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ maps: [makeMap()] }));
    renderWithQueryClient(<MapPickerRaidTime normalizedName="reserve" />);

    expect(await screen.findByText("45m")).toBeInTheDocument();
    expect(screen.getByText("38m")).toBeInTheDocument();
  });

  it("renders nothing for an unknown map (no raid times to show)", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { container } = renderWithQueryClient(
      <MapPickerRaidTime normalizedName="not-a-real-map" />,
    );
    await vi.waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a map has neither raid duration nor player count", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ maps: [makeMap({ raidDuration: null, players: null })] }),
    );
    const { container } = renderWithQueryClient(<MapPickerRaidTime normalizedName="reserve" />);

    await vi.waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });
});
