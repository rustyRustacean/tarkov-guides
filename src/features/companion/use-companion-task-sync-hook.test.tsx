import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompanionTaskSync } from "./use-companion-task-sync";

import type { CompanionQuestStatus } from "./companion-config";
import type { TaskProgress } from "@/features/progress-tracker/types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

interface MockState {
  activeMode: string;
  taskStatus: Record<string, TaskProgress>;
  quests: Record<string, CompanionQuestStatus>;
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
      questCounts: { finished: 0, started: 0, failed: 0 },
      mode: mocks.state.mode,
      profileId: "game-profile",
    },
  }),
  useCompanionSyncRequest: () => 0,
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
  useActiveProgress: () => ({ taskStatus: mocks.state.taskStatus }),
}));

vi.mock("@/features/progress-tracker/store", () => ({
  useProgressTrackerStore: (selector: (state: Record<string, unknown>) => unknown): unknown =>
    selector({
      activeProfileId: "site-profile",
      activeMode: mocks.state.activeMode,
      setTaskStatuses: mocks.setTaskStatuses,
    }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.activeMode = "PVP";
  mocks.state.taskStatus = {};
  mocks.state.quests = { t1: "finished" };
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

  it("reconciles again when the site's own task state changes underneath it", () => {
    const { rerender } = renderHook(() => {
      useCompanionTaskSync();
    });
    mocks.state.taskStatus = { t1: { status: "done" } };
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(1);

    mocks.state.taskStatus = {};
    rerender();
    expect(mocks.setTaskStatuses).toHaveBeenCalledTimes(2);
    expect(mocks.setTaskStatuses).toHaveBeenLastCalledWith({ t1: { status: "done" } });
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
