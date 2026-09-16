import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { createTestQueryClient } from "@/test/render-with-providers";

import { useMapSidebarHasContent } from "./use-map-sidebar-has-content";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";
import type { ReactNode } from "react";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialProgressState = useProgressTrackerStore.getInitialState();

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

function mapRef(normalizedName: string): { name: string; normalizedName: string } {
  return { name: normalizedName, normalizedName };
}

function activateProfile(): string {
  return useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
}

function renderUseMapSidebarHasContent(normalizedName: string) {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => useMapSidebarHasContent(normalizedName), { wrapper: Wrapper });
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
});

describe("useMapSidebarHasContent", () => {
  it("returns false immediately when there's no active profile at all", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { result } = renderUseMapSidebarHasContent("reserve");

    expect(result.current).toBe(false);
  });

  it("returns false once loaded when the map has no inprog tasks or tracked items", async () => {
    activateProfile();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [makeTask({ id: "t1", map: mapRef("reserve") })] }),
    );
    const { result } = renderUseMapSidebarHasContent("reserve");

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns true once loaded when an inprog task is relevant to the map", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    const { result } = renderUseMapSidebarHasContent("reserve");

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("returns false for an inprog task that belongs to a different map", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", map: mapRef("woods") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    const { result } = renderUseMapSidebarHasContent("reserve");

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
