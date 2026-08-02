import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useItemDetailStore } from "@/shared/ui/item-detail/item-detail-store";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { MapRecommendationDialog } from "./MapRecommendationDialog";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

// The location title is a `TransitionLink` (`next/link` under the hood) to
// `/maps?map=...` - same minimal mock `Header.test.tsx` uses for the same
// component, since jsdom has no real Next.js app router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const initialState = useProgressTrackerStore.getInitialState();

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
    tasks: [],
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
  useProgressTrackerStore.setState(initialState, true);
  useItemDetailStore.setState({ current: null, stack: [] });
});

describe("MapRecommendationDialog", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("lists every location with available tasks, best (most tasks) first and marked", async () => {
    const customsA = makeTask({
      id: "customs-a",
      name: "Customs A",
      map: { name: "Customs", normalizedName: "customs" },
    });
    const customsB = makeTask({
      id: "customs-b",
      name: "Customs B",
      map: { name: "Customs", normalizedName: "customs" },
    });
    const woods = makeTask({
      id: "woods-a",
      name: "Woods A",
      map: { name: "Woods", normalizedName: "woods" },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [customsA, customsB, woods] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Customs")).toBeInTheDocument();
    });
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
    expect(screen.getByText("Woods")).toBeInTheDocument();
    expect(screen.getByText("1 task")).toBeInTheDocument();
    expect(screen.getByText("Customs A")).toBeInTheDocument();
    expect(screen.getByText("Customs B")).toBeInTheDocument();
    expect(screen.getByText("Woods A")).toBeInTheDocument();
    expect(screen.getByText("Best")).toBeInTheDocument();
  });

  it("links each location's title to that map on the Maps page", async () => {
    const customsA = makeTask({
      id: "customs-a",
      name: "Customs A",
      map: { name: "Customs", normalizedName: "customs" },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [customsA] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    const link = await screen.findByRole("link", { name: "Customs" });
    expect(link).toHaveAttribute("href", "/maps?map=customs");
  });

  it("opens the task detail popup via the shared item-detail store when a task is clicked", async () => {
    const user = userEvent.setup();
    const customsA = makeTask({
      id: "customs-a",
      name: "Customs A",
      map: { name: "Customs", normalizedName: "customs" },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [customsA] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Customs A")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Customs A"));
    expect(useItemDetailStore.getState().current).toEqual({ type: "task", id: "customs-a" });
  });

  it("excludes Lightkeeper tasks unless the toggle is checked", async () => {
    const user = userEvent.setup();
    const lightkeeperTask = makeTask({
      id: "lk-1",
      name: "Lightkeeper Task",
      map: { name: "Lighthouse", normalizedName: "lighthouse" },
      lightkeeperRequired: true,
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [lightkeeperTask] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/no tasks match these filters/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Include Lightkeeper tasks"));
    await waitFor(() => {
      expect(screen.getByText("1 task")).toBeInTheDocument();
    });
  });

  it("restricts to Kappa-required tasks when Kappa only is checked", async () => {
    const user = userEvent.setup();
    const normalTask = makeTask({
      id: "normal",
      name: "Normal Task",
      map: { name: "Customs", normalizedName: "customs" },
      kappaRequired: false,
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [normalTask] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("1 task")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Kappa only"));
    await waitFor(() => {
      expect(screen.getByText(/no tasks match these filters/i)).toBeInTheDocument();
    });
  });

  it("keeps filter toggles checked across close and reopen, since the component itself never unmounts", async () => {
    // The dialog's own doc comment used to (incorrectly) claim this state
    // resets on reopen. It doesn't: `MapRecommendationDialog` is rendered
    // unconditionally by `QuestBoard`, so only Radix's `DialogContent`
    // portal unmounts on close, not this component's `useState`. Renders
    // with the same JSX across `rerender` calls (not a fresh `render`) to
    // simulate that real always-mounted parent, matching the doc comment's
    // corrected claim.
    const user = userEvent.setup();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { rerender } = renderWithQueryClient(
      <MapRecommendationDialog open onOpenChange={vi.fn()} />,
    );
    await user.click(screen.getByLabelText("Kappa only"));
    expect(screen.getByLabelText("Kappa only")).toBeChecked();

    rerender(<MapRecommendationDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<MapRecommendationDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText("Kappa only")).toBeChecked();
  });
});
