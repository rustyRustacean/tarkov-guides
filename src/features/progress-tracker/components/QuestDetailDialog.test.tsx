import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestDetailDialog } from "./QuestDetailDialog";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
    id: "task-1",
    name: "Debut",
    kappaRequired: false,
    minPlayerLevel: 1,
    experience: 1500,
    wikiLink: "https://example.com/wiki",
    factionName: null,
    taskImageLink: null,
    availableDelaySecondsMin: 0,
    availableDelaySecondsMax: 0,
    restartable: false,
    lightkeeperRequired: false,
    requiredPrestige: null,
    trader: { id: "prapor-id", name: "Prapor", imageLink: null },
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

function taskRequirement(taskId: string): RawTask["taskRequirements"][number] {
  return { task: { id: taskId }, status: ["complete"] };
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
});

describe("QuestDetailDialog", () => {
  it("renders nothing open when taskId is null", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(
      <QuestDetailDialog
        taskId={null}
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows quest name, trader, XP, wiki link, and prerequisites/unlocks once open", async () => {
    const prereq = makeTask({ id: "prereq", name: "Prerequisite Quest" });
    const dependent = makeTask({
      id: "dependent",
      name: "Dependent Quest",
      taskRequirements: [taskRequirement("task-1")],
    });
    const debut = makeTask({
      taskRequirements: [taskRequirement("prereq")],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [prereq, debut, dependent] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Debut" })).toBeInTheDocument();
    });
    expect(screen.getByText("Prapor")).toBeInTheDocument();
    expect(screen.getByText("1,500 XP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wiki guide" })).toHaveAttribute(
      "href",
      "https://example.com/wiki",
    );
    expect(screen.getByRole("button", { name: "Prerequisite Quest" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dependent Quest" })).toBeInTheDocument();
  });

  it("calls onSelectTask when clicking a prerequisite", async () => {
    const user = userEvent.setup();
    const prereq = makeTask({ id: "prereq", name: "Prerequisite Quest" });
    const debut = makeTask({ taskRequirements: [taskRequirement("prereq")] });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [prereq, debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const onSelectTask = vi.fn();
    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={onSelectTask}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Prerequisite Quest" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Prerequisite Quest" }));
    expect(onSelectTask).toHaveBeenCalledWith("prereq");
  });

  it("shows an ETA hint instead of a bare 'Locked' badge once the prerequisite is done but the real delay hasn't elapsed - real values from 'The Door' (2026-07-16 audit)", async () => {
    const signalPart3 = makeTask({ id: "signal-part-3", name: "Signal - Part 3" });
    const theDoor = makeTask({
      id: "task-1",
      name: "The Door",
      minPlayerLevel: 20,
      availableDelaySecondsMin: 7200,
      availableDelaySecondsMax: 7700,
      taskRequirements: [taskRequirement("signal-part-3")],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [signalPart3, theDoor] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setPlayerLevel(20);
    useProgressTrackerStore.getState().setTaskStatuses({
      "signal-part-3": { status: "done", completedAt: new Date().toISOString() },
    });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "The Door" })).toBeInTheDocument();
    });
    expect(screen.getByText(/Locked - unlocks in ~2\.0-2\.1 hrs/)).toBeInTheDocument();
  });

  it("shows a full-width hero image when taskImageLink is present", async () => {
    const debut = makeTask({ taskImageLink: "https://assets.example.com/debut.png" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Debut" })).toBeInTheDocument();
    });
    // The hero now sits above (a sibling of, not nested inside) the heading.
    // Radix portals `DialogContent` to `document.body`, outside RTL's
    // `container`, so queries here search the whole document instead.
    const hero = document.body.querySelector('img[src="https://assets.example.com/debut.png"]');
    expect(hero).toBeInTheDocument();
  });

  it("shows no hero image block when taskImageLink is absent", async () => {
    const debut = makeTask({ taskImageLink: null });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Debut" })).toBeInTheDocument();
    });
    expect(document.body.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows a Lightkeeper badge when the task counts toward Lightkeeper access", async () => {
    const debut = makeTask({ lightkeeperRequired: true });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Lightkeeper")).toBeInTheDocument();
    });
  });

  it("shows the full reward breakdown - trader standing, trader unlock, offer unlock, and skill rewards, not just items", async () => {
    const debut = makeTask({
      finishRewards: {
        items: [
          {
            item: { id: "i1", name: "Bitcoin", shortName: "BTC", iconLink: null, basePrice: 100 },
            count: 2,
          },
        ],
        traderStanding: [{ trader: { name: "Prapor" }, standing: 0.02 }],
        traderUnlock: [{ name: "Jaeger" }],
        offerUnlock: [
          {
            trader: { name: "Prapor" },
            level: 2,
            item: { name: "AKS-74UB", shortName: "AKS", iconLink: null },
          },
        ],
        skillLevelReward: [{ name: "Endurance", level: 1 }],
      },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Bitcoin × 2")).toBeInTheDocument();
    });
    expect(screen.getByText("Prapor Rep +0.02")).toBeInTheDocument();
    expect(screen.getByText("Unlocks Jaeger")).toBeInTheDocument();
    expect(screen.getByText("Unlocks purchase of AKS-74UB at Prapor LL2")).toBeInTheDocument();
    expect(screen.getByText("Endurance +1")).toBeInTheDocument();
  });

  it("shows starting rewards in their own section", async () => {
    const debut = makeTask({
      startRewards: {
        items: [
          {
            item: {
              id: "i1",
              name: "MS2000 Marker",
              shortName: "MS2000",
              iconLink: null,
              basePrice: 0,
            },
            count: 1,
          },
        ],
        traderStanding: [],
        traderUnlock: [],
        offerUnlock: [],
        skillLevelReward: [],
      },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Starting rewards")).toBeInTheDocument();
    });
    expect(screen.getByText("MS2000 Marker × 1")).toBeInTheDocument();
  });

  it("does not show an empty 'Starting rewards' section when startRewards is a non-null object with nothing in it (a real tarkov.dev shape, confirmed via a live browser check against the real 'Debut' task)", async () => {
    const debut = makeTask({
      startRewards: {
        items: [],
        traderStanding: [],
        traderUnlock: [],
        offerUnlock: [],
        skillLevelReward: [],
      },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Debut" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Starting rewards")).not.toBeInTheDocument();
  });

  it("shows fail conditions", async () => {
    const debut = makeTask({
      failConditions: [
        { id: "fc-1", type: "basic", description: "Do not get shot", optional: false, maps: [] },
      ],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Fail conditions")).toBeInTheDocument();
    });
    expect(screen.getByText("Do not get shot")).toBeInTheDocument();
  });

  it("shows the failure outcome rewards", async () => {
    const debut = makeTask({
      failureOutcome: {
        items: [
          {
            item: {
              id: "i1",
              name: "Consolation Prize",
              shortName: "CP",
              iconLink: null,
              basePrice: 0,
            },
            count: 1,
          },
        ],
        traderStanding: [],
        traderUnlock: [],
        offerUnlock: [],
        skillLevelReward: [],
      },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("If this task fails")).toBeInTheDocument();
    });
    expect(screen.getByText("Consolation Prize × 1")).toBeInTheDocument();
  });

  it("does not show an empty 'If this task fails' section when failureOutcome is a non-null object with nothing in it", async () => {
    const debut = makeTask({
      failureOutcome: {
        items: [],
        traderStanding: [],
        traderUnlock: [],
        offerUnlock: [],
        skillLevelReward: [],
      },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Debut" })).toBeInTheDocument();
    });
    expect(screen.queryByText("If this task fails")).not.toBeInTheDocument();
  });

  it("notes that a non-restartable task cannot be retried, only while it's in progress", async () => {
    const debut = makeTask({ restartable: false });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ "task-1": { status: "inprog" } });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("This task cannot be retried after failing.")).toBeInTheDocument();
    });
  });

  it("does not show the non-restartable note for a task that has not been started", async () => {
    const debut = makeTask({ restartable: false });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Debut" })).toBeInTheDocument();
    });
    expect(
      screen.queryByText("This task cannot be retried after failing."),
    ).not.toBeInTheDocument();
  });

  it("starting the task from the dialog updates the store", async () => {
    const user = userEvent.setup();
    const debut = makeTask();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.taskStatus["task-1"]?.status,
    ).toBe("inprog");
  });

  it("promotes exactly one section card to span both grid columns when the visible section count is odd", async () => {
    // Default fixture has no objectives/item/trader requirements, so only
    // Prerequisites + Unlocks + Rewards render - 3 sections, an odd count.
    const debut = makeTask();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Prerequisites")).toBeInTheDocument();
    });
    // Radix portals `DialogContent` to `document.body`, outside RTL's
    // `container`, so this queries the whole document instead.
    const featuredCards = document.body.querySelectorAll(".sm\\:col-span-2");
    expect(featuredCards).toHaveLength(1);
  });

  it("promotes no section when the visible section count is even", async () => {
    // Adding Objectives brings the count to 4 (Prerequisites, Unlocks,
    // Objectives, Rewards) - an even count needs no full-width promotion.
    const debut = makeTask({
      objectives: [
        {
          id: "o1",
          type: "basic",
          description: "Find respirators in raid",
          optional: false,
          maps: [],
        },
      ],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(
      <QuestDetailDialog
        taskId="task-1"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Find respirators in raid")).toBeInTheDocument();
    });
    expect(document.body.querySelectorAll(".sm\\:col-span-2")).toHaveLength(0);
  });
});
