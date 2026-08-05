import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useGameDataBannerStore } from "@/shared/lib/tarkov-api/game-data-banner-store";
import { useSiteStatusBannerStore } from "@/shared/ui/site-status-banner/site-status-banner-store";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useMapsStore } from "../store";

import { MapsPage } from "./MapsPage";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

// SessionControls (rendered as part of the map screen's floating chrome)
// reads the invite-link `?session=` param via `next/navigation` - this test
// environment has no real Next.js app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/maps",
  useSearchParams: () => new URLSearchParams(),
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
  useGameDataBannerStore.setState({ dismissedAt: 0 });
  // Dismissed by default so these tests exercise the game-data banner's
  // viewport-reservation logic in isolation; the dedicated tests below
  // re-enable it to cover the site-status-banner and both-banners cases.
  useSiteStatusBannerStore.setState({ dismissed: true });
  mockViewport(false);
  vi.spyOn(localStorageAdapter, "read").mockResolvedValue(null);
  vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
  vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
});

describe("MapsPage", () => {
  it("renders the picker and defaults to Reserve's screen layout", async () => {
    renderWithQueryClient(<MapsPage />);

    expect(screen.getByRole("tab", { name: "Reserve" })).toHaveAttribute("data-state", "active");
    // No active profile in this fixture, so the Items/Tasks panel
    // auto-collapses by default (`useAutoCollapseEmptyLeftPanel`) - its
    // "Expand" toggle is the stable "screen layout rendered" signal here.
    expect(
      await screen.findByRole("button", { name: "Expand items & tasks panel" }),
    ).toBeInTheDocument();
  });

  it("renders the live TarkovClock in the map-picker row, above the map", async () => {
    renderWithQueryClient(<MapsPage />);
    expect(await screen.findByText("L")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("switching the picker swaps which map's screen layout renders", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<MapsPage />);
    await screen.findByRole("button", { name: "Expand items & tasks panel" });

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

  it("uses only the header height in its viewport calc when the game-data banner isn't showing", async () => {
    const { container } = renderWithQueryClient(<MapsPage />);
    await screen.findByRole("button", { name: "Expand items & tasks panel" });

    expect(container.querySelector(".flex.w-full.flex-col")).toHaveClass("h-[calc(100vh-3.5rem)]");
  });

  it("reserves extra height above the map for the game-data banner once a fetch fails", async () => {
    vi.mocked(fetchTarkovGameData).mockRejectedValue(new Error("network down"));
    const { container } = renderWithQueryClient(<MapsPage />);

    await waitFor(() => {
      expect(container.querySelector(".flex.w-full.flex-col")).toHaveClass(
        "h-[calc(100vh-3.5rem-2.25rem)]",
      );
    });
  });

  it("reserves extra height above the map for the site-status banner when it hasn't been dismissed", async () => {
    useSiteStatusBannerStore.setState({ dismissed: false });
    const { container } = renderWithQueryClient(<MapsPage />);

    await waitFor(() => {
      expect(container.querySelector(".flex.w-full.flex-col")).toHaveClass(
        "h-[calc(100vh-3.5rem-2.25rem)]",
      );
    });
  });

  it("reserves double the height when both banners are visible at once", async () => {
    useSiteStatusBannerStore.setState({ dismissed: false });
    vi.mocked(fetchTarkovGameData).mockRejectedValue(new Error("network down"));
    const { container } = renderWithQueryClient(<MapsPage />);

    await waitFor(() => {
      expect(container.querySelector(".flex.w-full.flex-col")).toHaveClass("h-[calc(100vh-8rem)]");
    });
  });
});
