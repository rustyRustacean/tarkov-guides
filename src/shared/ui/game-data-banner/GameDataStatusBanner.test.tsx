import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TARKOV_GAME_DATA_QUERY_KEY } from "@/shared/lib/tarkov-api/constants";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useGameDataBannerStore } from "@/shared/lib/tarkov-api/game-data-banner-store";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { GameDataStatusBanner } from "./GameDataStatusBanner";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
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
  useGameDataBannerStore.setState({ dismissedAt: 0 });
});

describe("GameDataStatusBanner", () => {
  it("renders nothing while the fetch is loading or has succeeded", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<GameDataStatusBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // Give the (successful) query a tick to settle, then re-check.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the harder 'no data' message when a fetch fails with nothing cached", async () => {
    vi.mocked(fetchTarkovGameData).mockRejectedValue(new Error("network down"));
    renderWithQueryClient(<GameDataStatusBanner />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "task, item, and map data can't load right now",
    );
  });

  it("shows the softer 'cached data' message when a refetch fails but previous data exists", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValueOnce(makeRawData());
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <GameDataStatusBanner />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    vi.mocked(fetchTarkovGameData).mockRejectedValueOnce(new Error("network down"));
    await queryClient.refetchQueries({ queryKey: TARKOV_GAME_DATA_QUERY_KEY });

    expect(await screen.findByRole("status")).toHaveTextContent("showing cached data");
  });

  it("dismissing hides the banner immediately", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTarkovGameData).mockRejectedValue(new Error("network down"));
    renderWithQueryClient(<GameDataStatusBanner />);

    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
