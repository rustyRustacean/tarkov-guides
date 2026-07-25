import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { useToastStore } from "@/shared/ui/toast/toast-store";
import { createTestQueryClient } from "@/test/render-with-providers";

import { getQuestAvailability } from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { useTaskActions } from "./use-task-actions";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";
import type { ReactNode } from "react";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();
const NOW = "2026-07-22T12:00:00.000Z";

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

/** `RawTask` has no `itemRequirements` field directly - it's derived by `normalizeTask` from `objectives`, so tests needing a task to end up with real item requirements build a `find`-type objective instead. */
function makeFindObjective(itemId: string, count: number) {
  return {
    id: `obj-${itemId}`,
    type: "find",
    description: `Find ${String(count)} in raid`,
    optional: false,
    maps: [],
    item: { id: itemId, name: itemId, shortName: itemId, iconLink: null },
    count,
    foundInRaid: true,
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

/** Renders `useTaskActions()` alongside `useTarkovGameData()` in the same hook so tests can `waitFor` the mocked fetch to resolve before invoking any action (otherwise `tasksById` would still be empty on the very first synchronous call). */
function renderUseTaskActions() {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => ({ actions: useTaskActions(), query: useTarkovGameData() }), {
    wrapper: Wrapper,
  });
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  useToastStore.setState({ toast: null });
  // Only `Date` is faked (not `setTimeout`/`setInterval`) so `waitFor`'s own
  // internal polling and React Query's async resolution keep working on
  // real timers - only `completedAt`'s `new Date().toISOString()` needs a
  // deterministic value.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTaskActions", () => {
  it("startTask sets status to inprog and cascades strictly-complete prerequisites", async () => {
    const prereq = makeTask({ id: "prereq" });
    const target = makeTask({
      id: "target",
      taskRequirements: [{ task: { id: "prereq" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [prereq, target] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(2);
    });

    act(() => {
      result.current.actions.startTask("target");
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[profileId];
    expect(progress?.taskStatus.target?.status).toBe("inprog");
    expect(progress?.taskStatus.prereq).toEqual({
      status: "done",
      autoDone: true,
      completedAt: NOW,
    });
  });

  it("startTask shows a toast with an UNDO action that restores the prior state", async () => {
    const target = makeTask({ id: "target" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.actions.startTask("target");
    });

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.taskStatus.target?.status,
    ).toBe("inprog");
    const activeToast = useToastStore.getState().toast;
    expect(activeToast?.message).toContain("Started");
    expect(activeToast?.action?.label).toBe("UNDO");

    act(() => {
      activeToast?.action?.onClick();
    });

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.taskStatus.target,
    ).toBeUndefined();
  });

  it("doneTask captures a have-count snapshot and auto-starts an unlocked task when autoStartNext is true", async () => {
    const unlocked = makeTask({
      id: "unlocked",
      taskRequirements: [{ task: { id: "target" }, status: ["complete"] }],
    });
    const target = makeTask({
      id: "target",
      objectives: [makeFindObjective("item-a", 1)],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target, unlocked] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 5);
    expect(useProgressTrackerStore.getState().autoStartNext).toBe(true);

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(2);
    });

    act(() => {
      result.current.actions.doneTask("target");
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[profileId];
    expect(progress?.taskStatus.target?.status).toBe("done");
    expect(progress?.taskStatus.target?.snapshot).toEqual({ "item-a": 5 });
    expect(progress?.taskStatus.target?.completedAt).toBe(NOW);
    expect(progress?.taskStatus.unlocked?.status).toBe("inprog");
    expect(progress?.taskStatus.unlocked?.autoStarted).toBe(true);
  });

  it("a delay-gated dependent stays locked immediately after its prerequisite is completed via doneTask - regression test for the dead completedAt bug (C-1): the delay gate has its own passing unit tests in isolation, but those hand-set `completedAt` directly rather than driving it through a real mutation, which is exactly how this bug hid", async () => {
    const prereq = makeTask({ id: "prereq" });
    const delayed = makeTask({
      id: "delayed",
      availableDelaySecondsMin: 7200,
      availableDelaySecondsMax: 7700,
      taskRequirements: [{ task: { id: "prereq" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [prereq, delayed] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(2);
    });

    act(() => {
      result.current.actions.doneTask("prereq");
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[profileId];
    if (!progress) throw new Error("expected profile progress to exist");
    expect(progress.taskStatus.prereq?.completedAt).toBe(NOW);

    const availability = getQuestAvailability(
      result.current.query.data?.tasks ?? [],
      progress,
      "BEAR",
    ).get("delayed");
    expect(availability?.isAvailable).toBe(false);
    expect(availability?.delayedUnlock).not.toBeNull();
  });

  it("failTask sets status to failed without touching have/pending", async () => {
    const target = makeTask({ id: "target" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.actions.failTask("target");
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[profileId];
    expect(progress?.taskStatus.target?.status).toBe("failed");
    expect(progress?.taskStatus.target?.completedAt).toBe(NOW);
  });

  it("undoTask restores have from the completion snapshot and reverts status to inprog", async () => {
    const target = makeTask({
      id: "target",
      objectives: [makeFindObjective("item-a", 1)],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 5);

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.actions.doneTask("target");
    });
    // Simulate stash count changing after completion - undoTask should
    // restore it back to what it was AT completion time, not just "before
    // the current click".
    act(() => {
      useProgressTrackerStore.getState().setHave("item-a", 999);
    });

    act(() => {
      result.current.actions.undoTask("target");
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[profileId];
    expect(progress?.have["item-a"]).toBe(5);
    expect(progress?.taskStatus.target?.status).toBe("inprog");
    expect(progress?.taskStatus.target?.snapshot).toBeUndefined();
  });

  it("undoTask is a no-op on a notstarted or inprog task", async () => {
    const target = makeTask({ id: "target" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.actions.undoTask("target");
    });

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.taskStatus.target,
    ).toBeUndefined();
  });

  it("unstartTask reverts an inprog task to notstarted, dropping autoStarted", async () => {
    const target = makeTask({ id: "target" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.actions.startTask("target");
    });
    act(() => {
      result.current.actions.unstartTask("target");
    });

    const progress = useProgressTrackerStore.getState().progressByProfile[profileId];
    expect(progress?.taskStatus.target).toEqual({ status: "notstarted" });
    const activeToast = useToastStore.getState().toast;
    expect(activeToast?.message).toContain("Reset to not started");
    expect(activeToast?.action?.label).toBe("UNDO");
  });

  it("unstartTask is a no-op on a notstarted/done/failed task", async () => {
    const target = makeTask({ id: "target" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.actions.unstartTask("target");
    });

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.taskStatus.target,
    ).toBeUndefined();
  });

  it("is a no-op when there is no active profile", async () => {
    const target = makeTask({ id: "target" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [target] }));

    const { result } = renderUseTaskActions();
    await waitFor(() => {
      expect(result.current.query.data?.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.actions.startTask("target");
    });

    expect(useProgressTrackerStore.getState().progressByProfile).toEqual({});
  });
});
