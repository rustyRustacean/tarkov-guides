import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { useToastStore } from "@/shared/ui/toast/toast-store";
import { createTestQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { useHideoutTracker } from "./use-hideout-tracker";

import type { RawHideoutStation, RawTarkovApiResponseData } from "@/shared/lib/tarkov-api/types";
import type { ReactNode } from "react";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

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
    // useTarkovGameData() treats {tasks: [], items: []} as a failed
    // refresh - at least one non-empty task/item is needed even for tests
    // that only care about hideoutStations.
    tasks: [
      {
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
      },
    ],
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

function renderUseHideoutTracker() {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => ({ actions: useHideoutTracker(), query: useTarkovGameData() }), {
    wrapper: Wrapper,
  });
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  useToastStore.setState({ toast: null });
});

describe("useHideoutTracker", () => {
  it("toggleLevel building a level cascades down through the same station and toasts 'Built: …'", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseHideoutTracker();
    await waitFor(() => {
      expect(result.current.query.data?.hideoutStations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.toggleLevel("workbench", "Workbench", 2);
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.hideoutBuilt).toEqual({ "workbench:1": true, "workbench:2": true });
    expect(useToastStore.getState().toast?.message).toBe("Built: Workbench L2");
  });

  it("toggleLevel un-building removes only the exact level and toasts 'Un-built: …'", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore
      .getState()
      .replaceHideoutBuilt({ "workbench:1": true, "workbench:2": true });

    const { result } = renderUseHideoutTracker();
    await waitFor(() => {
      expect(result.current.query.data?.hideoutStations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.toggleLevel("workbench", "Workbench", 2);
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.hideoutBuilt).toEqual({ "workbench:1": true });
    expect(useToastStore.getState().toast?.message).toBe("Un-built: Workbench L2");
  });

  it("toggleGoal sets the goal and toasts 'Goal set: …'", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseHideoutTracker();
    await waitFor(() => {
      expect(result.current.query.data?.hideoutStations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.toggleGoal("workbench", "Workbench", 2);
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.hideoutGoal).toEqual({ stationNormalizedName: "workbench", level: 2 });
    expect(useToastStore.getState().toast?.message).toBe("Goal set: Workbench L2");
  });

  it("toggleGoal on the current goal clears it and toasts 'Goal cleared'", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore
      .getState()
      .setHideoutGoal({ stationNormalizedName: "workbench", level: 2 });

    const { result } = renderUseHideoutTracker();
    await waitFor(() => {
      expect(result.current.query.data?.hideoutStations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.toggleGoal("workbench", "Workbench", 2);
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.hideoutGoal).toBeNull();
    expect(useToastStore.getState().toast?.message).toBe("Goal cleared");
  });

  it("is a no-op when there is no active profile", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());

    const { result } = renderUseHideoutTracker();
    await waitFor(() => {
      expect(result.current.query.data?.hideoutStations).toHaveLength(1);
    });

    act(() => {
      result.current.actions.toggleLevel("workbench", "Workbench", 1);
      result.current.actions.toggleGoal("workbench", "Workbench", 1);
    });

    expect(useProgressTrackerStore.getState().progressByProfile).toEqual({});
    expect(useToastStore.getState().toast).toBeNull();
  });
});
