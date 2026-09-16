import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestSwimlaneMatrix } from "./QuestSwimlaneMatrix";

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

describe("QuestSwimlaneMatrix", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<QuestSwimlaneMatrix />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("renders a trader column header and places a task chip in its resolved bucket", async () => {
    const debut = makeTask({
      id: "5936d90786f7742b1420ba5b", // real Prapor "Debut", curated LL1
      name: "Debut",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestSwimlaneMatrix />);

    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.getByText("Prapor")).toBeInTheDocument();
    expect(screen.getByText("Loyalty Level 1")).toBeInTheDocument();
  });

  it("places a task with no curated override or API level gate in the Unconfirmed row", async () => {
    const task = makeTask({
      id: "not-curated",
      name: "Some Unknown Task",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestSwimlaneMatrix />);

    await waitFor(() => {
      expect(screen.getByText("Some Unknown Task")).toBeInTheDocument();
    });
    expect(screen.getByText("Unconfirmed")).toBeInTheDocument();
  });

  it("shows locked tasks by default, hiding them via Show locked", async () => {
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

    renderWithQueryClient(<QuestSwimlaneMatrix />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Show locked"));
    expect(screen.queryByText("Shooting Cans")).not.toBeInTheDocument();
  });

  it("filters chips by searchQuery", async () => {
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const other = makeTask({
      id: "other",
      name: "Totally Different Quest",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, other] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestSwimlaneMatrix searchQuery="Debut" />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.queryByText("Totally Different Quest")).not.toBeInTheDocument();
  });

  it("stacks a detected multi-part chain into one collapsed card, expanding to show each part", async () => {
    const user = userEvent.setup();
    const part1 = makeTask({
      id: "sb-1",
      name: "Small Business - Part 1",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const part2 = makeTask({
      id: "sb-2",
      name: "Small Business - Part 2",
      trader: { id: "p", name: "Prapor", imageLink: null },
      taskRequirements: [{ task: { id: "sb-1" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [part1, part2] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestSwimlaneMatrix />);
    await waitFor(() => {
      expect(screen.getByText("Small Business")).toBeInTheDocument();
    });
    expect(screen.getByText("2 parts")).toBeInTheDocument();
    expect(screen.queryByText("Small Business - Part 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Small Business - Part 2")).not.toBeInTheDocument();

    await user.click(screen.getByText("Small Business"));
    expect(screen.getByText("Small Business - Part 1")).toBeInTheDocument();
    expect(screen.getByText("Small Business - Part 2")).toBeInTheDocument();
  });

  it("scrolls to and highlights a task named by focusRequest", async () => {
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestSwimlaneMatrix focusRequest={{ taskId: "debut", nonce: 1 }} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Debut/ })).toHaveClass("animate-pulse");
    });
  });

  it("expands a collapsed chain and highlights the specific part named by focusRequest", async () => {
    const part1 = makeTask({
      id: "sb-1",
      name: "Small Business - Part 1",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const part2 = makeTask({
      id: "sb-2",
      name: "Small Business - Part 2",
      trader: { id: "p", name: "Prapor", imageLink: null },
      taskRequirements: [{ task: { id: "sb-1" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [part1, part2] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestSwimlaneMatrix focusRequest={{ taskId: "sb-2", nonce: 1 }} />);
    await waitFor(() => {
      expect(screen.getByText("Small Business - Part 2")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Small Business - Part 2/ })).toHaveClass(
        "animate-pulse",
      );
    });
  });

  it("opens the quest detail dialog when a task chip is clicked", async () => {
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

    renderWithQueryClient(<QuestSwimlaneMatrix />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Debut"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
