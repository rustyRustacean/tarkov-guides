import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestBoard } from "./QuestBoard";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.mocked(fetchTarkovGameData).mockResolvedValue({
    tasks: [],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    maps: [],
    traders: [],
    barters: [],
    crafts: [],
  });
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

  it("switches to the Recommendations tab and shows the recommendations view", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<QuestBoard />);
    await user.click(screen.getByRole("tab", { name: "Recommendations" }));
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
});
