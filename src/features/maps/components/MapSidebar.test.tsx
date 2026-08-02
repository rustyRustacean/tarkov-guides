import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useMapsStore } from "../store";

import { MapSidebar } from "./MapSidebar";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialProgressState = useProgressTrackerStore.getInitialState();
const initialMapsState = useMapsStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  useMapsStore.setState(initialMapsState, true);
});

function mapRef(normalizedName: string): { name: string; normalizedName: string } {
  return { name: normalizedName, normalizedName };
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

function activateProfile(): string {
  return useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
}

describe("MapSidebar", () => {
  it("defaults to the Items pane and shows its empty state", async () => {
    activateProfile();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapSidebar normalizedName="reserve" />);
    expect(await screen.findByText(/No active items for reserve/)).toBeInTheDocument();
  });

  it("switching to the Tasks tab shows the Tasks pane", async () => {
    activateProfile();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapSidebar normalizedName="reserve" />);
    await screen.findByText(/No active items for reserve/);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Missions" }));

    expect(await screen.findByText("Nothing active on this map")).toBeInTheDocument();
  });

  it("typing does not auto-switch panes - the query targets the active pane", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", name: "Woods Task", map: mapRef("woods") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    renderWithQueryClient(<MapSidebar normalizedName="reserve" />);
    await screen.findByText(/No active items for reserve/);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: "woods" },
    });

    // Stays on the Items pane (no auto-switch); the Tasks-only match is not shown.
    expect(screen.getByRole("tab", { name: "Task Items" })).toHaveAttribute("data-state", "active");
    expect(screen.queryByText("Woods Task")).not.toBeInTheDocument();
  });

  it("typing on the Tasks pane searches tasks across maps", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", name: "Woods Task", map: mapRef("woods") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    renderWithQueryClient(<MapSidebar normalizedName="reserve" />);
    await screen.findByText(/No active items for reserve/);

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Missions" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: "woods" },
    });

    expect(await screen.findByText("Woods Task")).toBeInTheDocument();
  });

  it("shows item rows needed by an inprog task relevant to the map, and their custom items separately", async () => {
    const task = makeTask({
      id: "t1",
      map: mapRef("reserve"),
      objectives: [
        {
          id: "obj-1",
          type: "findItem",
          description: "Find loot",
          optional: false,
          maps: [],
          item: { id: "item-a", name: "Bolts", shortName: "Bolts", iconLink: null },
          count: 3,
          foundInRaid: false,
        },
      ],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    activateProfile();
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });
    useProgressTrackerStore
      .getState()
      .setCustomItems([{ id: "custom-1", name: "Custom Thing", iconLink: null, need: 1 }]);

    renderWithQueryClient(<MapSidebar normalizedName="reserve" />);

    expect(await screen.findByText("Bolts")).toBeInTheDocument();
    expect(screen.getByText("Custom Thing")).toBeInTheDocument();
    expect(screen.getByText("◆ Custom Items")).toBeInTheDocument();
  });
});
