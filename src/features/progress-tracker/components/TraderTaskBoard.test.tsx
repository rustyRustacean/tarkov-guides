import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { TraderTaskBoard } from "./TraderTaskBoard";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

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

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

describe("TraderTaskBoard", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<TraderTaskBoard />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("renders one section per trader, in canonical roster order", async () => {
    const skierTask = makeTask({
      id: "skier-task",
      name: "Skier Quest",
      trader: { id: "s", name: "Skier", imageLink: null },
    });
    const praporTask = makeTask({
      id: "prapor-task",
      name: "Prapor Quest",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [skierTask, praporTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<TraderTaskBoard />);

    await waitFor(() => {
      expect(screen.getByText("Prapor Quest")).toBeInTheDocument();
    });
    expect(screen.getByText("Skier Quest")).toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.indexOf("Prapor")).toBeLessThan(headings.indexOf("Skier"));
    expect(screen.getAllByText("1 quests")).toHaveLength(2);
  });

  it("hides locked tasks by default, revealing them via Show locked", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const cans = makeTask({
      id: "cans",
      name: "Shooting Cans",
      trader: { id: "p", name: "Prapor", imageLink: null },
      taskRequirements: [{ task: { id: "debut" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, cans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<TraderTaskBoard />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.queryByText("Shooting Cans")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Show locked"));
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
  });

  it("sorts each trader's section by tasks-behind count descending, with pinned tasks still first", async () => {
    const root = makeTask({
      id: "root",
      name: "Root Quest",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const dependentA = makeTask({
      id: "dependent-a",
      name: "Dependent A",
      trader: { id: "p", name: "Prapor", imageLink: null },
      taskRequirements: [{ task: { id: "root" }, status: ["complete"] }],
    });
    const dependentB = makeTask({
      id: "dependent-b",
      name: "Dependent B",
      trader: { id: "p", name: "Prapor", imageLink: null },
      taskRequirements: [{ task: { id: "root" }, status: ["complete"] }],
    });
    const leaf = makeTask({
      id: "leaf",
      name: "Leaf Quest",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const pinnedLeaf = makeTask({
      id: "pinned-leaf",
      name: "Pinned Leaf",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [root, dependentA, dependentB, leaf, pinnedLeaf] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().togglePinnedTask("pinned-leaf");

    renderWithQueryClient(<TraderTaskBoard />);
    await waitFor(() => {
      expect(screen.getByText("Root Quest")).toBeInTheDocument();
    });

    // "Dependent A"/"Dependent B" are locked (require "Root Quest") and
    // hidden by default, so only the 3 visible tasks matter here: pinned
    // always leads, then "Root Quest" (2 tasks behind it) outranks the
    // behind-count-0 "Leaf Quest".
    expect(screen.getByText("2 behind")).toBeInTheDocument();
    const pinned = screen.getByText("Pinned Leaf");
    const rootQuest = screen.getByText("Root Quest");
    const leafQuest = screen.getByText("Leaf Quest");
    expect(
      pinned.compareDocumentPosition(rootQuest) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      rootQuest.compareDocumentPosition(leafQuest) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("clicking Start actually starts the task via the store", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<TraderTaskBoard />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.taskStatus.debut
        ?.status,
    ).toBe("inprog");
  });

  it("clicking a quest opens its detail dialog - regression test for M-3 (Trader view had no way to open quest detail)", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<TraderTaskBoard />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByText("Debut"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("No prerequisites.")).toBeInTheDocument();
  });

  it("filters by the searchQuery prop, dropping a trader section entirely once none of its tasks match", async () => {
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const cans = makeTask({
      id: "cans",
      name: "Shooting Cans",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const skierTask = makeTask({
      id: "skier-task",
      name: "Skier Quest",
      trader: { id: "s", name: "Skier", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [debut, cans, skierTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { rerender } = renderWithQueryClient(<TraderTaskBoard searchQuery="" />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    rerender(<TraderTaskBoard searchQuery="cans" />);
    expect(screen.queryByText("Debut")).not.toBeInTheDocument();
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
    // Skier had no matching task at all - its whole section is gone, not
    // just left empty.
    expect(screen.queryByText("Skier")).not.toBeInTheDocument();
  });

  it("shows a per-trader progress bar computed against the trader's full task set, unaffected by Show locked", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const locked = makeTask({
      id: "locked-quest",
      name: "Locked Quest",
      trader: { id: "p", name: "Prapor", imageLink: null },
      taskRequirements: [{ task: { id: "debut" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, locked] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<TraderTaskBoard />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    // "Locked Quest" is hidden by default - the trader has 2 total tasks
    // (0 done), even though only 1 is currently visible.
    expect(screen.getByText("0/2")).toBeInTheDocument();
    expect(screen.getByText("1 quests")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Show locked"));
    expect(screen.getByText("Locked Quest")).toBeInTheDocument();
    // Denominator is unchanged by toggling Show locked.
    expect(screen.getByText("0/2")).toBeInTheDocument();
    expect(screen.getByText("2 quests")).toBeInTheDocument();
  });
});
