import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompanionTaskSync } from "./use-companion-task-sync";

import type { CompanionQuestStatus } from "./companion-config";
import type { TaskProgress } from "@/features/progress-tracker/types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

interface MockState {
  activeMode: string;
  /** `null` stands for a profile with no character in the active mode. */
  taskStatus: Record<string, TaskProgress> | null;
  quests: Record<string, CompanionQuestStatus>;
  questCounts: { finished: number; started: number; failed: number };
  syncRequest: number;
  hydrationCount: number;
  mode: string;
  linked: Record<string, string>;
}

const mocks = vi.hoisted(() => ({
  setTaskStatuses: vi.fn(),
  reportCompanionSync: vi.fn(),
  reportCompanionSyncSkipped: vi.fn(),
  state: {} as MockState,
}));

vi.mock("./use-companion", () => ({
  reportCompanionSync: mocks.reportCompanionSync,
  reportCompanionSyncSkipped: mocks.reportCompanionSyncSkipped,
  useCompanionStatus: () => ({
    isConnected: true,
    status: {
      quests: mocks.state.quests,
      questCounts: mocks.state.questCounts,
      mode: mocks.state.mode,
      profileId: "game-profile",
    },
  }),
  useCompanionSyncRequest: () => mocks.state.syncRequest,
  useEverConnected: () => [true],
}));

vi.mock("./use-companion-profile-sync", () => ({
  useProfileSyncPreference: () => [true],
  readProfileMap: () => mocks.state.linked,
  linkedSiteProfileId: (value: string) => value,
  companionModeToProfileMode: (mode: string) => mode.toUpperCase(),
}));

const TASKS = new Map<string, NormalizedTask>([
  ["t1", { id: "t1", taskRequirements: [] } as never],
]);

vi.mock("@/features/progress-tracker/hooks/use-active-mode-tasks", () => ({
  useActiveModeTasks: () => ({ tasksById: TASKS }),
}));

vi.mock("@/features/progress-tracker/hooks/use-active-progress", () => ({
  useActiveProgress: () =>
    mocks.state.taskStatus === null ? undefined : { taskStatus: mocks.state.taskStatus },
}));

vi.mock("@/features/progress-tracker/store", () => ({
  useProgressTrackerStore: (selector: (state: Record<string, unknown>) => unknown): unknown =>
    selector({
      activeProfileId: "site-profile",
      activeMode: mocks.state.activeMode,
      hydrationCount: mocks.state.hydrationCount,
      setTaskStatuses: mocks.setTaskStatuses,
    }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.activeMode = "PVP";
  mocks.state.taskStatus = {};
  mocks.state.quests = { t1: "finished" };
  mocks.state.questCounts = { finished: 1, started: 0, failed: 0 };
  mocks.state.syncRequest = 0;
  mocks.state.hydrationCount = 0;
  mocks.state.mode = "pvp";
  mocks.state.linked = {};
});

describe("useCompanionTaskSync", () => {
  it("applies the companion state once, and treats the re-render its own write causes as settled", () => {
    const { rerender } = renderHook(() => {
      useCompanionTaskSync();
    });
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(1);

    mocks.state.taskStatus = { t1: { status: "done" } };
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(1);
    expect(mocks.reportCompanionSync).toHaveBeenCalledTimes(1);
  });

  it("leaves a manual edit alone until the game reports something new", () => {
    const { rerender } = renderHook(() => {
      useCompanionTaskSync();
    });
    mocks.state.taskStatus = { t1: { status: "done" } };
    rerender();

    // The user reverts the task by hand: the sync does not undo that.
    mocks.state.taskStatus = { t1: { status: "inprog" } };
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(1);

    // The game reports a new quest event: the next pass reconciles.
    mocks.state.questCounts = { finished: 1, started: 1, failed: 0 };
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(2);
    expect(mocks.setTaskStatuses).toHaveBeenLastCalledWith({ t1: { status: "done" } });
  });

  it("reconciles again on Sync now, even with no new game events", () => {
    const { rerender } = renderHook(() => {
      useCompanionTaskSync();
    });
    mocks.state.taskStatus = { t1: { status: "inprog" } };
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(1);

    mocks.state.syncRequest = 1;
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(2);
  });

  it("reconciles again when a profile is loaded from elsewhere (hydrate)", () => {
    const { rerender } = renderHook(() => {
      useCompanionTaskSync();
    });
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(1);

    // Saved state arrives late and holds none of the game's progress.
    mocks.state.taskStatus = {};
    mocks.state.hydrationCount = 1;
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(2);
    expect(mocks.setTaskStatuses).toHaveBeenLastCalledWith({ t1: { status: "done" } });
  });

  it("reports a missing mode character instead of claiming tasks were updated", () => {
    mocks.state.taskStatus = null;
    renderHook(() => {
      useCompanionTaskSync();
    });
    expect(mocks.setTaskStatuses).not.toHaveBeenCalled();
    expect(mocks.reportCompanionSync).not.toHaveBeenCalled();
    expect(mocks.reportCompanionSyncSkipped).toHaveBeenCalledWith("setup");
  });

  it("reports a mode mismatch instead of syncing silently", () => {
    mocks.state.activeMode = "PVE";
    renderHook(() => {
      useCompanionTaskSync();
    });
    expect(mocks.setTaskStatuses).not.toHaveBeenCalled();
    expect(mocks.reportCompanionSyncSkipped).toHaveBeenCalledWith("mode");
  });

  it("reports a profile mismatch instead of syncing silently", () => {
    mocks.state.linked = { "game-profile": "another-profile" };
    renderHook(() => {
      useCompanionTaskSync();
    });
    expect(mocks.setTaskStatuses).not.toHaveBeenCalled();
    expect(mocks.reportCompanionSyncSkipped).toHaveBeenCalledWith("profile");
  });
});
