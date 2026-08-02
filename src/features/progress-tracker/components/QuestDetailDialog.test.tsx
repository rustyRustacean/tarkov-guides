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

// Keeps the real `wikiSlugFromLink` (used to derive the query key from a
// task's `wikiLink`) while overriding `fetchWikiGuideData` with per-slug
// fixtures - avoids every test hitting the real wiki over the network the
// way an unmocked `useWikiGuideData` otherwise would.
vi.mock("@/shared/lib/wiki/fetch-wiki", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/wiki/fetch-wiki")>();
  return {
    ...actual,
    fetchWikiGuideData: vi.fn((slug: string) => {
      if (slug === "wiki") {
        return {
          text: "",
          images: [{ src: "https://example.com/guide.png", caption: "Example step" }],
        };
      }
      if (slug === "Task_With_Sections") {
        return {
          text: "",
          images: [
            { src: "https://example.com/overview.png", caption: "Overview map" },
            { src: "https://example.com/a1.png", caption: "First step", section: "Objective A" },
            { src: "https://example.com/a2.png", caption: "Second step", section: "Objective A" },
            { src: "https://example.com/b1.png", caption: "Only step", section: "Objective B" },
          ],
        };
      }
      return { text: "", images: [] };
    }),
  };
});

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

  it("styles the finish XP reward as a distinct stat chip, not a bare text line", async () => {
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
      expect(screen.getByText("1,500 XP")).toBeInTheDocument();
    });
    expect(screen.getByText("1,500 XP")).toHaveClass("font-bold");
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
        traderStanding: [
          { trader: { id: "prapor-id", name: "Prapor", imageLink: null }, standing: 0.02 },
        ],
        traderUnlock: [{ trader: { id: "jaeger-id", name: "Jaeger", imageLink: null } }],
        offerUnlock: [
          {
            trader: { id: "prapor-id", name: "Prapor", imageLink: null },
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
      expect(screen.getByText("BTC")).toBeInTheDocument();
    });
    expect(screen.getByText("×2")).toBeInTheDocument();
    // Not a bare `getByText("Prapor")` - this task's own trader is also
    // "Prapor" (rendered once by `TaskBadges`), so that string alone would
    // now match 2 elements. The trader-standing tile's unique caption is
    // what actually verifies the reward tile rendered.
    expect(screen.getByText("+0.02")).toBeInTheDocument();
    expect(screen.getByText("Jaeger")).toBeInTheDocument();
    expect(screen.getByText("Unlocked")).toBeInTheDocument();
    expect(screen.getByText("AKS")).toBeInTheDocument();
    expect(screen.getByText("Prapor LL2")).toBeInTheDocument();
    expect(screen.getByText("Endurance")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("shows a Roubles reward as an abbreviated amount in card mode, and the full precise amount in list mode", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      finishRewards: {
        items: [
          {
            item: { id: "rub", name: "Roubles", shortName: "RUB", iconLink: null, basePrice: 1 },
            count: 15000,
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

    // Card mode (default): abbreviated - the full comma-grouped form was
    // confirmed to genuinely overflow-clip inside a narrow tile column.
    await waitFor(() => {
      expect(screen.getByText("15K₽")).toBeInTheDocument();
    });
    // No "RUB" shortName label and no "×15000" corner badge - the formatted
    // amount replaces both for a money reward.
    expect(screen.queryByText("RUB")).not.toBeInTheDocument();
    expect(screen.queryByText("×15000")).not.toBeInTheDocument();

    // List mode has the room for the real, precise figure.
    await user.click(screen.getByRole("button", { name: "Switch to list view" }));
    expect(screen.getByText("15,000₽")).toBeInTheDocument();
    expect(screen.queryByText("15K₽")).not.toBeInTheDocument();
  });

  it("gives a caption-less reward tile (e.g. a Roubles reward) the same vertical centering as a two-line sibling, avoiding a lopsided gap below its single line", async () => {
    const debut = makeTask({
      finishRewards: {
        items: [
          {
            item: { id: "rub", name: "Roubles", shortName: "RUB", iconLink: null, basePrice: 1 },
            count: 15000,
          },
        ],
        traderStanding: [
          { trader: { id: "prapor-id", name: "Prapor", imageLink: null }, standing: 0.02 },
        ],
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
      expect(screen.getByText("15K₽")).toBeInTheDocument();
    });
    // The money tile has only one text line (no caption) - its own <li>
    // must still center its content vertically like its two-line
    // "+0.02"-captioned sibling, not top-align and leave a gap below.
    const moneyTile = screen.getByText("15K₽").closest("li");
    expect(moneyTile).toHaveClass("justify-center");
  });

  it("toggles every reward section between card and list view together, from any one section's toggle", async () => {
    const user = userEvent.setup();
    const debut = makeTask({
      startRewards: {
        items: [
          {
            item: { id: "i2", name: "MS2000", shortName: "MS2000", iconLink: null, basePrice: 0 },
            count: 1,
          },
        ],
        traderStanding: [],
        traderUnlock: [],
        offerUnlock: [],
        skillLevelReward: [],
      },
      finishRewards: {
        items: [
          {
            item: { id: "i1", name: "Bitcoin", shortName: "BTC", iconLink: null, basePrice: 100 },
            count: 2,
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
      expect(screen.getByText("BTC")).toBeInTheDocument();
    });
    // Card mode: label and "×N" badge render as separate text nodes.
    expect(screen.getByText("×2")).toBeInTheDocument();
    expect(screen.queryByText("BTC ×2")).not.toBeInTheDocument();

    const toggles = screen.getAllByRole("button", { name: "Switch to list view" });
    expect(toggles).toHaveLength(2); // Starting rewards + Rewards sections.
    const firstToggle = toggles[0];
    if (!firstToggle) throw new Error("toggle button not found");
    await user.click(firstToggle);

    // List mode, everywhere at once: one combined text node per entry, no
    // more standalone "×2" badge node.
    expect(screen.getByText("BTC ×2")).toBeInTheDocument();
    expect(screen.getByText("MS2000")).toBeInTheDocument();
    expect(screen.queryByText("×2")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Switch to grid view" })).toHaveLength(2);
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
    expect(screen.getByText("MS2000")).toBeInTheDocument();
    // count is 1, not > 1 - no "×1" quantity-badge noise.
    expect(screen.queryByText("×1")).not.toBeInTheDocument();
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
    expect(screen.getByText("CP")).toBeInTheDocument();
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

  it("shows a Screenshots section with the live-fetched wiki images", async () => {
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

    expect(await screen.findByAltText("Example step")).toBeInTheDocument();
    expect(screen.getByText("Screenshots")).toBeInTheDocument();
  });

  it("opens the lightbox at the right image when a screenshot thumbnail is clicked", async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByAltText("Example step"));

    // The lightbox is a second, nested dialog - both it and the quest
    // detail dialog itself have role="dialog", so scope to the lightbox's
    // own heading (the image caption) to confirm it opened with the right
    // image rather than just asserting *some* dialog exists.
    expect(await screen.findByRole("heading", { name: "Example step" })).toBeInTheDocument();
  });

  it("groups screenshots into labeled sections when the wiki page has them", async () => {
    const debut = makeTask({
      id: "task-with-sections",
      wikiLink: "https://escapefromtarkov.fandom.com/wiki/Task_With_Sections",
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
        taskId="task-with-sections"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    // Section headings for the named subsections, none for the leading
    // unsectioned overview image.
    expect(
      await screen.findByRole("heading", { name: "Objective A", level: 4 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Objective B", level: 4 })).toBeInTheDocument();
    // Every image (sectioned and not) still renders as a thumbnail.
    expect(screen.getByAltText("Overview map")).toBeInTheDocument();
    expect(screen.getByAltText("First step")).toBeInTheDocument();
    expect(screen.getByAltText("Second step")).toBeInTheDocument();
    expect(screen.getByAltText("Only step")).toBeInTheDocument();
  });

  it("shows no Screenshots section when the wiki page has no Guide-section images", async () => {
    const debut = makeTask({
      id: "no-guide-task",
      wikiLink: "https://escapefromtarkov.fandom.com/wiki/No_Guide_Task",
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
        taskId="no-guide-task"
        onOpenChange={() => undefined}
        onSelectTask={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Find respirators in raid")).toBeInTheDocument();
    });
    expect(screen.queryByText("Screenshots")).not.toBeInTheDocument();
  });
});
