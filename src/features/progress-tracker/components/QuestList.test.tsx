import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestList } from "./QuestList";

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

describe("QuestList", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<QuestList />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("renders every task once live data resolves", async () => {
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const shootingCans = makeTask({
      id: "cans",
      name: "Shooting Cans",
      trader: { id: "s", name: "Skier", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestList />);

    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
  });

  it("filters by the searchQuery prop (the search box now lives in QuestBoard's shared toolbar, not here)", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    const shootingCans = makeTask({ id: "cans", name: "Shooting Cans" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { rerender } = renderWithQueryClient(<QuestList searchQuery="" />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    rerender(<QuestList searchQuery="cans" />);
    expect(screen.queryByText("Debut")).not.toBeInTheDocument();
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
  });

  it("filters by kappaOnly", async () => {
    const user = userEvent.setup();
    const kappaTask = makeTask({ id: "kappa-task", name: "Kappa Task", kappaRequired: true });
    const normalTask = makeTask({ id: "normal-task", name: "Normal Task", kappaRequired: false });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [kappaTask, normalTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestList />);
    await waitFor(() => {
      expect(screen.getByText("Normal Task")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Kappa only"));
    expect(screen.queryByText("Normal Task")).not.toBeInTheDocument();
    expect(screen.getByText("Kappa Task")).toBeInTheDocument();
  });

  it("hides locked tasks by default, revealing them via Show locked", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    const cans = makeTask({
      id: "cans",
      name: "Shooting Cans",
      taskRequirements: [{ task: { id: "debut" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, cans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestList />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.queryByText("Shooting Cans")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Show locked"));
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
  });

  it("shows the empty-filters message when nothing matches", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { rerender } = renderWithQueryClient(<QuestList searchQuery="" />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    rerender(<QuestList searchQuery="nonexistent" />);
    expect(screen.getByText(/no quests match your filters/i)).toBeInTheDocument();
  });

  it("clicking Start actually starts the task via the store", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestList />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`]?.taskStatus.debut
        ?.status,
    ).toBe("inprog");
  });

  it("clicking a quest opens its detail dialog - regression test for M-3 (List had no way to open quest detail)", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestList />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByText("Debut"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("No prerequisites.")).toBeInTheDocument();
  });
});
