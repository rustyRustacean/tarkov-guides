import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useMapsStore } from "../store";

import { MapSidebarTasks } from "./MapSidebarTasks";

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

function mapRef(normalizedName: string): { name: string; normalizedName: string } {
  return { name: normalizedName, normalizedName };
}

function activateProfile(): string {
  return useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
}

describe("MapSidebarTasks", () => {
  it("shows a fallback message when there's no active profile", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);
    expect(await screen.findByText("No active profile.")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is active on this map", async () => {
    const profileId = activateProfile();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    void profileId;
    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);
    expect(await screen.findByText("Nothing active on this map")).toBeInTheDocument();
  });

  it("renders an inprog task relevant to the map with Unstart/Done/Fail actions", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", name: "Reserve Task", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);

    expect(await screen.findByText("Reserve Task")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unstart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fail" })).toBeInTheDocument();
  });

  it("colors the trader name and gives the card a trader-tinted inner glow (matching the Progress Tracker)", async () => {
    activateProfile();
    const task = makeTask({
      id: "t1",
      name: "Reserve Task",
      map: mapRef("reserve"),
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);

    // Prapor is red in the Progress Tracker (getTraderOutlineColor) - the maps
    // row uses the same var, so the two always match.
    const traderLabel = await screen.findByText("PRAPOR");
    expect(traderLabel.getAttribute("style") ?? "").toContain("var(--color-status-red)");

    const card = traderLabel.closest("li");
    const cardStyle = card?.getAttribute("style") ?? "";
    expect(cardStyle).toContain("inset");
    expect(cardStyle).toContain("var(--color-status-red)");
  });

  it("clicking Done marks the task done via useTaskActions", async () => {
    const profileId = activateProfile();
    const task = makeTask({ id: "t1", name: "Reserve Task", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);
    await screen.findByText("Reserve Task");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.taskStatus.t1?.status,
    ).toBe("done");
  });

  it("clicking Unstart reverts an inprog task to notstarted", async () => {
    const profileId = activateProfile();
    const task = makeTask({ id: "t1", name: "Reserve Task", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);
    await screen.findByText("Reserve Task");

    fireEvent.click(screen.getByRole("button", { name: "Unstart" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.taskStatus.t1?.status,
    ).toBe("notstarted");
  });

  it("toggling the display-on-map checkbox sets a per-task override", async () => {
    const profileId = activateProfile();
    const task = makeTask({ id: "t1", name: "Reserve Task", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);
    await screen.findByText("Reserve Task");

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    expect(useMapsStore.getState().profileState[profileId]?.taskDisplayOverrides.t1).toBe(false);
  });

  it("double-clicking a task row toggles its pinned state", async () => {
    const profileId = activateProfile();
    const task = makeTask({ id: "t1", name: "Reserve Task", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);
    const row = await screen.findByText("Reserve Task");
    fireEvent.doubleClick(row);

    expect(useProgressTrackerStore.getState().progressByProfile[profileId]?.pinnedTaskIds).toEqual([
      "t1",
    ]);
  });

  it("shows an 'any map' divider between map-specific and any-map groups", async () => {
    activateProfile();
    const specific = makeTask({
      id: "specific",
      name: "Specific Task",
      map: mapRef("reserve"),
    });
    const anyMap = makeTask({ id: "any", name: "Any Map Task" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [specific, anyMap] }));
    useProgressTrackerStore
      .getState()
      .setTaskStatuses({ specific: { status: "inprog" }, any: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);

    expect(await screen.findByText("Specific Task")).toBeInTheDocument();
    expect(screen.getByText("Any Map Task")).toBeInTheDocument();
    expect(screen.getByText("any map")).toBeInTheDocument();
  });

  it("search mode shows a match count and a go-to-map button for off-map results", async () => {
    activateProfile();
    const task = makeTask({
      id: "t1",
      name: "Woods Task",
      map: mapRef("woods"),
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="woods" />);

    expect(await screen.findByText(/1 match for/)).toBeInTheDocument();
    expect(screen.getByText("Woods Task")).toBeInTheDocument();
    expect(screen.getByText(/go to/)).toBeInTheDocument();
  });

  it("search mode shows a no-match message for an unmatched query", async () => {
    activateProfile();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="nonexistent" />);
    expect(await screen.findByText("No tasks match")).toBeInTheDocument();
  });

  it("clicking a task name opens the QuestDetailDialog", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", name: "Reserve Task", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="" />);
    const row = await screen.findByText("Reserve Task");
    fireEvent.click(row);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("clicking a search result opens the QuestDetailDialog too", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", name: "Woods Task", map: mapRef("woods") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));

    renderWithQueryClient(<MapSidebarTasks normalizedName="reserve" searchQuery="woods" />);
    const row = await screen.findByText("Woods Task");
    fireEvent.click(row);

    // The dialog used to be mounted only inside the default (non-search) list,
    // so a search result recorded the selection but rendered nothing - it only
    // appeared once the query was cleared.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
