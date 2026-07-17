import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useMapsStore } from "../store";

import { MapsPage } from "./MapsPage";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useMapsStore.getInitialState();

function mockViewport(isMobile: boolean): void {
  window.matchMedia = (query: string) =>
    ({
      matches: isMobile,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
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

beforeEach(() => {
  useMapsStore.setState(initialState, true);
  mockViewport(false);
  vi.spyOn(localStorageAdapter, "read").mockResolvedValue(null);
  vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
  vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
});

describe("MapsPage", () => {
  it("renders the picker and defaults to Reserve's screen layout", async () => {
    renderWithQueryClient(<MapsPage />);

    expect(screen.getByRole("tab", { name: "Reserve" })).toHaveAttribute("data-state", "active");
    expect(await screen.findByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
  });

  it("switching the picker swaps which map's screen layout renders", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MapsPage />);
    await screen.findByRole("searchbox", { name: "Search tasks" });

    await user.click(screen.getByRole("tab", { name: "Woods" }));

    expect(useMapsStore.getState().currentMap).toBe("woods");
    expect(screen.getByRole("tab", { name: "Woods" })).toHaveAttribute("data-state", "active");
  });

  it("hydrates from localStorage on mount", async () => {
    renderWithQueryClient(<MapsPage />);

    await waitFor(() => {
      expect(localStorageAdapter.read).toHaveBeenCalled();
    });
  });
});
