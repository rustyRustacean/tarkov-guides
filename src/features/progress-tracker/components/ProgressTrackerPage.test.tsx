import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useProgressTrackerStore } from "../store";

import { ProgressTrackerPage } from "./ProgressTrackerPage";

import type { RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeRawTask(id: string): RawTask {
  return {
    id,
    name: id,
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
  };
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.spyOn(localStorageAdapter, "read").mockResolvedValue(null);
  vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
  // At least one non-empty section. An all-empty response trips
  // `useTarkovGameData`'s own "no usable task/item data" safety net and
  // resolves as a real query error, not a successful-but-empty one.
  // Previously invisible here since nothing read `isError`; now that
  // `GameDataGate` does, the fixture needs to reflect a genuine
  // successful load.
  vi.mocked(fetchTarkovGameData).mockResolvedValue({
    tasks: [makeRawTask("t1")],
    tasksPve: [],
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
    expect(screen.getByRole("tab", { name: "Quests" })).toBeInTheDocument();
  });

  it("shows the default Quests tab's own empty-state message when there is no active profile", async () => {
    renderWithQueryClient(<ProgressTrackerPage />);
    expect(await screen.findByText(/no active profile/i)).toBeInTheDocument();
  });

  it("hides the empty-state message once a profile is active", async () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    renderWithQueryClient(<ProgressTrackerPage />);
    // `findAllByText`, not `findByText`: Command Deck (the default tab)
    // shows the task's name twice at once - its sidebar row and the detail
    // pane's own heading.
    await screen.findAllByText("t1");
    expect(screen.queryByText(/no active profile/i)).not.toBeInTheDocument();
  });

  it("the tab bar and Backup tab are reachable even with no active profile", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ProgressTrackerPage />);

    await user.click(screen.getByRole("tab", { name: "Backup" }));
    expect(screen.getByRole("button", { name: "Export Backup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Backup" })).toBeInTheDocument();
  });

  // TODO: these tabs are only temporarily WIP-disabled (see ProgressTrackerPage.tsx).
  // Revert this test back to asserting they're reachable once that flag comes off.
  it("the Items/Guide/Kappa/Hideout tabs are disabled (WIP)", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ProgressTrackerPage />);

    for (const label of ["Items", "Guide", "Kappa", "Hideout"]) {
      const tab = screen.getByRole("tab", { name: new RegExp(label) });
      expect(tab).toBeDisabled();
      await user.click(tab);
      expect(screen.getByRole("tab", { name: "Quests", selected: true })).toBeInTheDocument();
    }
  });
});
