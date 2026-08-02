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
  vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
});

describe("QuestBoard", () => {
  it("defaults to the Tree tab, showing QuestTreeView content", () => {
    renderWithQueryClient(<QuestBoard />);
    expect(screen.getByRole("tab", { name: "Tree", selected: true })).toBeInTheDocument();
  });

  it("switches to the List tab and shows the quest list", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "List" }));
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("switches to the Trader tab and shows the trader board", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Trader" }));
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

  it("renders a single shared task search box in the toolbar", () => {
    renderWithQueryClient(<QuestBoard />);
    expect(screen.getByLabelText("Search tasks")).toBeInTheDocument();
  });

  it("filters the List view via the shared search box (the search that used to live inside QuestFilterBar)", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    const shootingCans = makeTask({ id: "cans", name: "Shooting Cans" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "List" }));
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search tasks"), "cans");
    // Dismiss the results dropdown (it also lists "Shooting Cans", which
    // would otherwise make the plain text query below ambiguous) - the
    // underlying List filter stays applied, only the suggestions close.
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Debut")).not.toBeInTheDocument();
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
  });

  it("filters the Trader view via the shared search box", async () => {
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
    await user.click(screen.getByRole("tab", { name: "Trader" }));
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search tasks"), "cans");
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Debut")).not.toBeInTheDocument();
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
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

  it("clicking a search-dropdown result switches to the Tree tab, autozooms/highlights the task, and clears the search box", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    const shootingCans = makeTask({ id: "cans", name: "Shooting Cans" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    // Start from a different tab - the click should switch away from it.
    await user.click(screen.getByRole("tab", { name: "List" }));
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search tasks"), "cans");
    await user.click(screen.getByRole("option", { name: /Shooting Cans/ }));

    expect(screen.getByRole("tab", { name: "Tree", selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Search tasks")).toHaveValue("");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Shooting Cans/ })).toHaveClass("ring-4");
    });
  });

  it("pressing Enter jumps to the top dropdown result in Tree", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestBoard />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search tasks"), "debut");
    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("Search tasks")).toHaveValue("");
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
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Search tasks"), "debut");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search tasks")).toHaveValue("debut");
    expect(screen.getByRole("tab", { name: "Tree", selected: true })).toBeInTheDocument();
  });
});
