import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { CommandDeckBoard } from "./CommandDeckBoard";

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

describe("CommandDeckBoard", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<CommandDeckBoard />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("defaults to the first roster trader and shows its tasks grouped by loyalty section", async () => {
    const debut = makeTask({
      id: "5936d90786f7742b1420ba5b", // real Prapor "Debut", curated LL1
      name: "Debut",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<CommandDeckBoard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Prapor/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByText("Loyalty Level 1")).toBeInTheDocument();
    // Appears once as the list row, once as the selected detail heading.
    expect(screen.getAllByText("Debut").length).toBeGreaterThanOrEqual(2);
  });

  it("switches the task list and detail panel when a different trader avatar is clicked", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      id: "5936d90786f7742b1420ba5b", // real Prapor "Debut", curated LL1
      name: "Debut",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    const firstInLine = makeTask({
      id: "657315ddab5a49b71f098853", // real Therapist "First in Line", curated LL1
      name: "First in Line",
      trader: { id: "therapist", name: "Therapist", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, firstInLine] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<CommandDeckBoard />);
    await waitFor(() => {
      expect(screen.getAllByText("Debut").length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText("First in Line")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Therapist/ }));

    await waitFor(() => {
      expect(screen.getAllByText("First in Line").length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText("Debut")).not.toBeInTheDocument();
  });

  it("hides locked tasks via Show locked and drops a trader with no remaining matches", async () => {
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

    const { container } = renderWithQueryClient(<CommandDeckBoard />);
    // Scoped to the sidebar row (`[data-task-id]`), not a page-wide text
    // query: with Debut selected by default, its own "Unlocks" section
    // (`QuestDetailSections`) already links to "Shooting Cans" by name too,
    // and that link is unaffected by the sidebar's own `showLocked` filter
    // (it reflects the task graph's real prerequisite/dependent structure,
    // not whatever's currently visible in the list).
    await waitFor(() => {
      expect(container.querySelector('[data-task-id="cans"]')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Show locked"));
    expect(container.querySelector('[data-task-id="cans"]')).not.toBeInTheDocument();
    expect(screen.getAllByText("Debut").length).toBeGreaterThanOrEqual(2);
  });

  it("selects the named task's trader and highlights its sidebar row when a focusRequest arrives", async () => {
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    const firstInLine = makeTask({
      id: "first-in-line",
      name: "First in Line",
      trader: { id: "therapist", name: "Therapist", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, firstInLine] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    // Renders with no focusRequest first and waits for game data to load,
    // mirroring real usage: `QuestBoard`'s search dropdown (the only real
    // source of a focusRequest) can't offer a result to click before the
    // task list it searches has itself loaded.
    const { rerender } = renderWithQueryClient(<CommandDeckBoard />);
    await waitFor(() => {
      expect(screen.getAllByText("Debut").length).toBeGreaterThan(0);
    });

    rerender(<CommandDeckBoard focusRequest={{ taskId: "first-in-line", nonce: 1 }} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Therapist/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await waitFor(() => {
      const row = screen.getByRole("button", { name: /First in Line/, hidden: false });
      expect(row).toHaveClass("animate-pulse");
    });
  });

  it("renders full quest details (prerequisites, rewards) inline instead of behind a separate dialog", async () => {
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<CommandDeckBoard />);
    await waitFor(() => {
      expect(screen.getAllByText("Debut").length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText("Prerequisites")).toBeInTheDocument();
    expect(screen.getByText("Rewards")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Full details" })).not.toBeInTheDocument();
  });
});
