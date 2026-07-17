import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useProgressTrackerStore } from "../store";

import { ProgressTrackerPage } from "./ProgressTrackerPage";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.spyOn(localStorageAdapter, "read").mockResolvedValue(null);
  vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
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

describe("ProgressTrackerPage", () => {
  it("renders without crashing", () => {
    renderWithQueryClient(<ProgressTrackerPage />);
    expect(screen.getByRole("heading", { name: "Progress Tracker" })).toBeInTheDocument();
  });

  it("shows the default Quests tab's own empty-state message when there is no active profile", () => {
    renderWithQueryClient(<ProgressTrackerPage />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("hides the empty-state message once a profile is active", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<ProgressTrackerPage />);
    expect(screen.queryByText(/no active profile/i)).not.toBeInTheDocument();
  });

  it("the tab bar and Backup tab are reachable even with no active profile", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ProgressTrackerPage />);

    await user.click(screen.getByRole("tab", { name: "Backup" }));
    expect(screen.getByRole("button", { name: "Export Backup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Backup" })).toBeInTheDocument();
  });

  it("renders the ProfileSwitcher", () => {
    renderWithQueryClient(<ProgressTrackerPage />);
    expect(screen.getByRole("button", { name: /No Profile/ })).toBeInTheDocument();
  });

  it("the Guide tab is reachable and shows the beginner-items reference content", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ProgressTrackerPage />);

    await user.click(screen.getByRole("tab", { name: "Guide" }));
    expect(screen.getByText(/Item data still loading|Hideout essentials/)).toBeInTheDocument();
  });

  it("defaults to the Quests tab and switches to Items", async () => {
    const user = userEvent.setup();
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<ProgressTrackerPage />);

    expect(screen.getByRole("tab", { name: "Quests", selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Items" }));
    expect(screen.getByText(/no items tracked yet|no active profile/i)).toBeInTheDocument();
  });
});
