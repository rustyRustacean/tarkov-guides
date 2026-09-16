import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestBoard } from "./QuestBoard";

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
  vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
});

describe("QuestBoard", () => {
  it("defaults to the Command Deck tab", () => {
    renderWithQueryClient(<QuestBoard />);
    expect(screen.getByRole("tab", { name: "Command Deck", selected: true })).toBeInTheDocument();
  });

  it("switches to the Tree tab and shows the quest tree", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Tree" }));
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("switches to the Command Deck tab and shows the command deck board", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Command Deck" }));
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("switches to the Analytics tab and shows the analytics view", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Analytics" }));
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("opens the map recommendation dialog from the toolbar button", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "What map do I go to?" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What map do I go to?" })).toBeInTheDocument();
  });

  it("opens the Kappa checklist dialog from the toolbar button", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kappa checklist" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kappa Checklist" })).toBeInTheDocument();
  });

  it("renders a single shared task search box in the toolbar", () => {
    renderWithQueryClient(<QuestBoard />);
    expect(screen.getByLabelText("Search tasks")).toBeInTheDocument();
  });

  it("filters the Command Deck view via the shared search box", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      id: "debut",
      name: "Debut",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    const shootingCans = makeTask({
      id: "cans",
      name: "Shooting Cans",
      trader: { id: "p", name: "Prapor", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Command Deck" }));
    await waitFor(() => {
      expect(screen.getAllByText("Debut").length).toBeGreaterThan(0);
    });

    await user.type(screen.getByLabelText("Search tasks"), "cans");
    // Dismiss the results dropdown (it also lists "Shooting Cans", which
    // would otherwise make the plain text query below ambiguous). The
    // underlying Command Deck filter stays applied, only the suggestions close.
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Debut")).not.toBeInTheDocument();
    expect(screen.getAllByText("Shooting Cans").length).toBeGreaterThan(0);
  });

  it("shows a results dropdown of matching tasks while the search box has text", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    const delivery = makeTask({ id: "delivery", name: "Delivery From The Past" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, delivery] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    await waitFor(() => {
      expect(screen.getByLabelText("Search tasks")).toBeInTheDocument();
    });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search tasks"), "de");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByRole("option", { name: /Debut/ })).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", { name: /Delivery From The Past/ }),
    ).toBeInTheDocument();
  });

  it("clicking a search-dropdown result focuses the task in the currently active tab (Command Deck) instead of switching tabs, and clears the search box", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    const shootingCans = makeTask({ id: "cans", name: "Shooting Cans" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Command Deck" }));
    await waitFor(() => {
      expect(screen.getAllByText("Debut").length).toBeGreaterThan(0);
    });

    await user.type(screen.getByLabelText("Search tasks"), "cans");
    await user.click(screen.getByRole("option", { name: /Shooting Cans/ }));

    // Stays on Command Deck: no tab switch, unlike the old force-to-Tree behavior.
    expect(screen.getByRole("tab", { name: "Command Deck", selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Search tasks")).toHaveValue("");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Shooting Cans/ })).toHaveClass("animate-pulse");
    });
  });

  it("clicking a search-dropdown result focuses the task in place on Matrix", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Matrix" }));
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search tasks"), "debut");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("tab", { name: "Matrix", selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Search tasks")).toHaveValue("");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Debut/ })).toHaveClass("ring-4");
    });
  });

  it("falls back to switching to Tree when a search-dropdown result is clicked while Analytics (no per-task view) is active", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Analytics" }));

    await user.type(screen.getByLabelText("Search tasks"), "debut");
    await user.click(screen.getByRole("option", { name: /Debut/ }));

    expect(screen.getByRole("tab", { name: "Tree", selected: true })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Debut/ })).toHaveClass("ring-4");
    });
  });

  it("Escape dismisses the dropdown without clearing the search text or changing tabs", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    // `getAllByText`, not `getByText`: Command Deck (the default tab) shows
    // the task's name twice at once - once in its sidebar list row, once
    // again as the detail pane's own heading - unlike Matrix's single chip.
    await waitFor(() => {
      expect(screen.getAllByText("Debut").length).toBeGreaterThan(0);
    });

    await user.type(screen.getByLabelText("Search tasks"), "debut");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search tasks")).toHaveValue("debut");
    expect(screen.getByRole("tab", { name: "Command Deck", selected: true })).toBeInTheDocument();
  });
});
