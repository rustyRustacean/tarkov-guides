import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "./fetch-tarkov-data";
import { useTarkovGameData } from "./use-tarkov-game-data";

import type { RawTarkovApiResponseData, RawTask } from "./types";
import type { ReactNode } from "react";

vi.mock("./fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

function makeRawTask(id: string): RawTask {
  return {
    id,
    name: id,
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

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

describe("useTarkovGameData", () => {
  it("resolves normalized data on success", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [makeRawTask("t1")] }));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTarkovGameData(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.tasks).toHaveLength(1);
    expect(result.current.data?.tasks[0]?.id).toBe("t1");
  });

  it("errors when both tasks and items end up empty with no previous cache", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTarkovGameData(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("tarkov.dev API returned no usable task/item data");
  });

  it("keeps a previously cached section when a refetch returns it empty", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValueOnce(
      makeRawData({ tasks: [makeRawTask("t1")] }),
    );
    const { Wrapper, queryClient } = createWrapper();

    const { result, rerender } = renderHook(() => useTarkovGameData(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.tasks).toHaveLength(1);

    // Second fetch comes back with an empty tasks array (simulated partial
    // outage); the merge should keep the previously cached task.
    vi.mocked(fetchTarkovGameData).mockResolvedValueOnce(makeRawData({ tasks: [] }));
    await result.current.refetch();
    rerender();

    await waitFor(() => {
      expect(result.current.data?.tasks).toHaveLength(1);
    });
    expect(result.current.data?.tasks[0]?.id).toBe("t1");
    queryClient.clear();
  });
});
