import { describe, expect, it } from "vitest";

import realQuests from "./__fixtures__/real-companion-quests.json";
import realTaskRequirements from "./__fixtures__/real-task-requirements.json";
import { buildSeasonalTaskSyncPatch, buildTaskSyncPatch } from "./use-companion-task-sync";

import type { CompanionQuestStatus } from "./companion-config";
import type { TaskProgress, TaskStatus } from "@/features/progress-tracker/types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

/** Minimal task; the cascade only reads `id`/`taskRequirements`. */
function task(id: string, requires: readonly string[] = []): NormalizedTask {
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
    requiredPrestigeLevel: null,
    trader: { id: "t", name: "T", imageLink: null },
    maps: [],
    taskRequirements: requires.map((taskId) => ({ taskId, status: ["complete"] as const })),
    traderRequirements: [],
    objectives: [],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
    itemRequirements: [],
  };
}

/** t1 <- t2 <- t3 (t3 requires t2, which requires t1). */
const CHAIN = new Map([
  ["t1", task("t1")],
  ["t2", task("t2", ["t1"])],
  ["t3", task("t3", ["t2"])],
]);

const quests: Record<string, CompanionQuestStatus> = {
  t_done: "finished",
  t_active: "started",
  t_failed: "failed",
};

describe("buildTaskSyncPatch", () => {
  it("maps companion statuses onto a fresh profile", () => {
    const patch = buildTaskSyncPatch(quests, {}, null);
    expect(patch).toEqual({
      t_done: { status: "done" },
      t_active: { status: "inprog" },
      t_failed: { status: "failed" },
    });
  });

  it("never downgrades further-along progress", () => {
    const current: Record<string, { status: TaskStatus }> = {
      t_done: { status: "done" }, // already done, companion also done -> no-op
      t_active: { status: "done" }, // done > inprog -> keep done
      t_failed: { status: "inprog" }, // inprog > failed -> keep inprog
    };
    const patch = buildTaskSyncPatch(quests, current, null);
    expect(patch).toEqual({});
  });

  it("upgrades notstarted/failed to a further-along status", () => {
    const current: Record<string, { status: TaskStatus }> = {
      t_done: { status: "inprog" }, // inprog -> done (upgrade)
      t_active: { status: "notstarted" }, // -> inprog
    };
    const patch = buildTaskSyncPatch(quests, current, null);
    expect(patch.t_done).toEqual({ status: "done" });
    expect(patch.t_active).toEqual({ status: "inprog" });
  });

  it("skips task ids the game data doesn't know", () => {
    const valid = new Set(["t_done"]);
    const patch = buildTaskSyncPatch(quests, {}, valid);
    expect(Object.keys(patch)).toEqual(["t_done"]);
  });
});

describe("buildSeasonalTaskSyncPatch", () => {
  it("resets cascade-fabricated dones, which a season's own unlock rules never justify", () => {
    const current = {
      t_cascaded: { status: "done" as TaskStatus, autoDone: true },
      t_manual: { status: "done" as TaskStatus },
    };
    const patch = buildSeasonalTaskSyncPatch({}, current, null);
    expect(patch.t_cascaded).toEqual({ status: "notstarted" });
    // Hand-ticked progress carries no `autoDone` flag and is left alone.
    expect(patch.t_manual).toBeUndefined();
  });

  it("re-adds a pruned task the logs actually prove", () => {
    const current = { t_done: { status: "done" as TaskStatus, autoDone: true } };
    const patch = buildSeasonalTaskSyncPatch(quests, current, null);
    expect(patch.t_done).toEqual({ status: "done" });
  });

  it("infers nothing from the standard prerequisite chain", () => {
    const patch = buildSeasonalTaskSyncPatch({ t3: "finished" }, {}, null);
    expect(patch).toEqual({ t3: { status: "done" } });
  });
});

describe("buildTaskSyncPatch prerequisite backfill", () => {
  it("backfills the whole chain when only the last task is in the logs", () => {
    // The player's logs only prove t3 finished (earlier logs cleared/missing).
    const patch = buildTaskSyncPatch({ t3: "finished" }, {}, null, CHAIN);
    expect(patch.t3).toMatchObject({ status: "done" });
    expect(patch.t2).toMatchObject({ status: "done", autoDone: true });
    expect(patch.t1).toMatchObject({ status: "done", autoDone: true });
  });

  it("backfills prerequisites of a merely-started task", () => {
    // Accepting t3 proves t1/t2 were completed, even though t3 isn't done.
    const patch = buildTaskSyncPatch({ t3: "started" }, {}, null, CHAIN);
    expect(patch.t3).toMatchObject({ status: "inprog" });
    expect(patch.t2).toMatchObject({ status: "done" });
    expect(patch.t1).toMatchObject({ status: "done" });
  });

  it("leaves prerequisites alone when already done", () => {
    const current = { t1: { status: "done" as TaskStatus }, t2: { status: "done" as TaskStatus } };
    const patch = buildTaskSyncPatch({ t3: "finished" }, current, null, CHAIN);
    expect(Object.keys(patch)).toEqual(["t3"]);
  });

  it("stays flat when no task data is supplied", () => {
    const patch = buildTaskSyncPatch({ t3: "finished" }, {}, null);
    expect(Object.keys(patch)).toEqual(["t3"]);
  });
});

describe("buildTaskSyncPatch evidence and rebuild rules", () => {
  it("never marks a task the companion reports started as done, even if a later task implies it", () => {
    const patch = buildTaskSyncPatch(
      { t1: "started", t2: "started", t3: "finished" },
      {},
      null,
      CHAIN,
    );
    expect(patch.t1).toEqual({ status: "inprog" });
    expect(patch.t2).toEqual({ status: "inprog" });
    expect(patch.t3).toEqual({ status: "done" });
  });

  it("resets an inferred done that the current prerequisites no longer justify", () => {
    const current: Record<string, TaskProgress> = {
      t1: { status: "done", autoDone: true },
      t_other: { status: "done" },
    };
    const patch = buildTaskSyncPatch({ t_other: "finished" }, current, null, CHAIN);
    expect(patch).toEqual({ t1: { status: "notstarted" } });
  });

  it("keeps an inferred done that is still justified, without rewriting it", () => {
    const current: Record<string, TaskProgress> = {
      t1: { status: "done", autoDone: true, completedAt: "2026-01-01T00:00:00.000Z" },
      t2: { status: "inprog" },
    };
    expect(buildTaskSyncPatch({ t2: "started" }, current, null, CHAIN)).toEqual({});
  });

  it("re-derives inferred dones from a manually ticked task", () => {
    const current: Record<string, TaskProgress> = {
      t3: { status: "done" },
      t1: { status: "done", autoDone: true },
      t2: { status: "done", autoDone: true },
    };
    expect(buildTaskSyncPatch({}, current, null, CHAIN)).toEqual({});
  });

  it("lets the companion's proof replace an inferred done", () => {
    const current: Record<string, TaskProgress> = {
      t1: { status: "done", autoDone: true },
      t2: { status: "done", autoDone: true },
      t3: { status: "done" },
    };
    expect(buildTaskSyncPatch({ t1: "finished" }, current, null, CHAIN)).toEqual({
      t1: { status: "done" },
    });
  });

  it("never touches a manual mark", () => {
    const current: Record<string, TaskProgress> = { t1: { status: "failed" } };
    const patch = buildTaskSyncPatch({ t3: "finished" }, current, null, CHAIN);
    expect(patch.t1).toBeUndefined();
  });
});

describe("buildTaskSyncPatch with a real companion state", () => {
  const REVISION_RESERVE = "6086c852c945025d41566124";
  const REVISION_LIGHTHOUSE = "6179b4d1bca27a099552e04e";
  const FUEL_MATTER = "608974d01a66564e74191fc0";

  const realTasks = new Map<string, NormalizedTask>(
    Object.entries(realTaskRequirements).map(([id, entry]) => [
      id,
      { ...task(id), name: entry.name, taskRequirements: entry.requires },
    ]),
  );
  const quests = realQuests.quests as Record<string, CompanionQuestStatus>;
  const validIds = new Set(realTasks.keys());

  it("has the reported situation: Lighthouse and Fuel Matter finished, Reserve only started", () => {
    expect(quests[REVISION_LIGHTHOUSE]).toBe("finished");
    expect(quests[FUEL_MATTER]).toBe("finished");
    expect(quests[REVISION_RESERVE]).toBe("started");
  });

  it("syncs Fuel Matter as done and Reserve as in progress onto a fresh profile", () => {
    const patch = buildTaskSyncPatch(quests, {}, validIds, realTasks);
    expect(patch[FUEL_MATTER]?.status).toBe("done");
    expect(patch[REVISION_LIGHTHOUSE]?.status).toBe("done");
    expect(patch[REVISION_RESERVE]?.status).toBe("inprog");
  });

  it("repairs a profile where the old cascade marked Reserve done", () => {
    const stale: Record<string, TaskProgress> = {
      [REVISION_RESERVE]: { status: "done", autoDone: true },
    };
    const patch = buildTaskSyncPatch(quests, stale, validIds, realTasks);
    expect(patch[REVISION_RESERVE]).toEqual({ status: "inprog" });
  });

  it("never infers done for a task the game reports started or failed", () => {
    const patch = buildTaskSyncPatch(quests, {}, validIds, realTasks);
    for (const [taskId, progress] of Object.entries(patch)) {
      if (progress.autoDone === true) {
        expect(["started", "failed"]).not.toContain(quests[taskId]);
      }
    }
  });

  it("settles: applying the patch and syncing again changes nothing", () => {
    const first = buildTaskSyncPatch(quests, {}, validIds, realTasks);
    const second = buildTaskSyncPatch(quests, first, validIds, realTasks);
    expect(second).toEqual({});
  });

  it("catches up a profile that is far behind", () => {
    const behind: Record<string, TaskProgress> = { [FUEL_MATTER]: { status: "notstarted" } };
    const patch = buildTaskSyncPatch(quests, behind, validIds, realTasks);
    expect(patch[FUEL_MATTER]?.status).toBe("done");
    expect(Object.keys(patch).length).toBeGreaterThan(100);
  });

  it("does not downgrade a profile that is ahead of the game", () => {
    const ahead: Record<string, TaskProgress> = { [REVISION_RESERVE]: { status: "done" } };
    expect(
      buildTaskSyncPatch(quests, ahead, validIds, realTasks)[REVISION_RESERVE],
    ).toBeUndefined();
  });
});
