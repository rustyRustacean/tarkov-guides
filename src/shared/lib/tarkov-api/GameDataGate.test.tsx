import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TARKOV_GAME_DATA_QUERY_KEY } from "./constants";
import { fetchTarkovGameData } from "./fetch-tarkov-data";
import { GameDataGate } from "./GameDataGate";

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
    tasks: [makeRawTask("t1")],
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

describe("GameDataGate", () => {
  it("shows a loading status and withholds children while the fetch is pending", () => {
    vi.mocked(fetchTarkovGameData).mockReturnValue(new Promise(() => undefined));
    const { Wrapper } = createWrapper();

    render(
      <GameDataGate>
        <p>content</p>
      </GameDataGate>,
      { wrapper: Wrapper },
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading Tarkov data");
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("shows an error alert with the failure message and a working Retry button", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTarkovGameData).mockRejectedValue(new Error("network down"));
    const { Wrapper } = createWrapper();

    render(
      <GameDataGate>
        <p>content</p>
      </GameDataGate>,
      { wrapper: Wrapper },
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("network down");
    expect(screen.queryByText("content")).not.toBeInTheDocument();

    const callsBeforeRetry = vi.mocked(fetchTarkovGameData).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(vi.mocked(fetchTarkovGameData).mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });

  it("renders children once data resolves, with neither status nor alert present", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { Wrapper } = createWrapper();

    render(
      <GameDataGate>
        <p>content</p>
      </GameDataGate>,
      { wrapper: Wrapper },
    );

    await screen.findByText("content");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps rendering children after a failed background refetch (stale-while-revalidate)", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { Wrapper, queryClient } = createWrapper();

    render(
      <GameDataGate>
        <p>content</p>
      </GameDataGate>,
      { wrapper: Wrapper },
    );
    await screen.findByText("content");

    vi.mocked(fetchTarkovGameData).mockRejectedValueOnce(new Error("network down"));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: TARKOV_GAME_DATA_QUERY_KEY });
    });

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
