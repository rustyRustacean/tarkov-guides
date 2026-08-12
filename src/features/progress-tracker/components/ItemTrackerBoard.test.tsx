import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { ItemTrackerBoard } from "./ItemTrackerBoard";

import type { RawItem, RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
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

function makeItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "item-a",
    name: "Item A",
    shortName: "A",
    iconLink: null,
    wikiLink: null,
    basePrice: 100,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types: [],
    sellFor: [],
    buyFor: [],
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

function itemObjectiveTask(): RawTask {
  return makeTask({
    id: "inprog-task",
    objectives: [
      {
        id: "obj-1",
        type: "findItem",
        description: "Find Item A",
        optional: false,
        maps: [],
        item: { id: "item-a", name: "Item A", shortName: "A", iconLink: null },
        count: 5,
        foundInRaid: true,
      },
    ],
  });
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

describe("ItemTrackerBoard", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<ItemTrackerBoard />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("renders a Needed row for an in-progress task's item requirement", async () => {
    const task = itemObjectiveTask();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [task], items: [makeItem()] }),
    );
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ "inprog-task": { status: "inprog" } });

    renderWithQueryClient(<ItemTrackerBoard />);

    await waitFor(() => {
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });
    expect(screen.getByText(/Needed \(1\)/)).toBeInTheDocument();
    expect(profileId).not.toBeNull();
  });

  it("buckets a pinned item into the Pinned section", async () => {
    const task = itemObjectiveTask();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [task], items: [makeItem()] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ "inprog-task": { status: "inprog" } });
    useProgressTrackerStore.getState().togglePinnedItem("item-a");

    renderWithQueryClient(<ItemTrackerBoard />);

    await waitFor(() => {
      expect(screen.getByText(/Pinned \(1\)/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Needed/)).not.toBeInTheDocument();
  });

  it("hides collected items behind a toggle, revealed on click", async () => {
    const task = itemObjectiveTask();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [task], items: [makeItem()] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ "inprog-task": { status: "inprog" } });
    useProgressTrackerStore.getState().setHave("item-a", 5);

    const user = userEvent.setup();
    renderWithQueryClient(<ItemTrackerBoard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Show Collected \(1\)/ })).toBeInTheDocument();
    });
    expect(screen.queryByText("Item A")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Show Collected \(1\)/ }));
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collected (1)" })).toBeInTheDocument();
  });

  it("renders custom items under their own section with a Remove button", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [makeItem()] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    expect(profileId).not.toBeNull();
    useProgressTrackerStore
      .getState()
      .setCustomItems([{ id: "item-a", name: "Item A", iconLink: null, need: 2 }]);

    renderWithQueryClient(<ItemTrackerBoard />);

    await waitFor(() => {
      expect(screen.getByText(/Custom Items \(1\)/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("clicking + adjusts pending through the store", async () => {
    const task = itemObjectiveTask();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [task], items: [makeItem()] }),
    );
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ "inprog-task": { status: "inprog" } });

    const user = userEvent.setup();
    renderWithQueryClient(<ItemTrackerBoard />);
    await waitFor(() => {
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Increase Pending Item A" }));

    const pending =
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.pending["item-a"];
    expect(pending).toBe(1);
  });
});
