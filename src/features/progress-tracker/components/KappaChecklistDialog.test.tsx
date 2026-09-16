import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useItemDetailStore } from "@/shared/ui/item-detail/item-detail-store";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { KappaChecklistDialog } from "./KappaChecklistDialog";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();
const initialItemDetailState = useItemDetailStore.getInitialState();

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
  useItemDetailStore.setState(initialItemDetailState, true);
});

describe("KappaChecklistDialog", () => {
  it("shows a no-active-profile message when nothing is active", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<KappaChecklistDialog open={true} onOpenChange={vi.fn()} />);
    expect(await screen.findByText(/no active profile/i)).toBeInTheDocument();
  });

  it("lists only kappaRequired tasks under the essential-tasks section", async () => {
    const kappaTask = makeTask({ id: "kappa-task", name: "Kappa Task", kappaRequired: true });
    const normalTask = makeTask({ id: "normal-task", name: "Normal Task", kappaRequired: false });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [kappaTask, normalTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<KappaChecklistDialog open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Kappa Task")).toBeInTheDocument();
    expect(screen.queryByText("Normal Task")).not.toBeInTheDocument();
  });

  it("shows Collector's traderRequirements with a met/not-met badge against real profile progress", async () => {
    const collector = makeTask({
      id: "collector",
      name: "Collector",
      kappaRequired: true,
      traderRequirements: [
        {
          id: "req-prapor",
          trader: { id: "prapor-id", name: "Prapor" },
          requirementType: "level",
          compareMethod: ">=",
          value: 4,
        },
        {
          id: "req-fence",
          trader: { id: "fence-id", name: "Fence" },
          requirementType: "reputation",
          compareMethod: ">=",
          value: 3,
        },
      ],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [collector] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTraderLevel("prapor-id", 4);
    useProgressTrackerStore.getState().setTraderReputation("fence-id", 1);

    renderWithQueryClient(<KappaChecklistDialog open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Prapor loyalty level >= 4")).toBeInTheDocument();
    expect(screen.getByText("Fence reputation >= 3")).toBeInTheDocument();
    expect(screen.getByText("Met")).toBeInTheDocument();
    expect(screen.getByText("Not met")).toBeInTheDocument();
  });

  it("opens the shared item-detail store (not a local dialog) when a task is clicked", async () => {
    const user = userEvent.setup();
    const kappaTask = makeTask({ id: "kappa-task", name: "Kappa Task", kappaRequired: true });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [kappaTask] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<KappaChecklistDialog open={true} onOpenChange={vi.fn()} />);
    await user.click(await screen.findByText("Kappa Task"));

    expect(useItemDetailStore.getState().current).toEqual({ type: "task", id: "kappa-task" });
  });
});
