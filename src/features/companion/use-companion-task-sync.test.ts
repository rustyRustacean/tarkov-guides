import { describe, expect, it } from "vitest";

import { buildSeasonalTaskSyncPatch, buildTaskSyncPatch } from "./use-companion-task-sync";

import type { CompanionQuestStatus } from "./companion-config";
import type { TaskStatus } from "@/features/progress-tracker/types";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

/** Minimal task; the cascade only reads `id`/`taskRequirements`. */
function task(id: string, requires: readonly string[] = []): NormalizedTask {
  return {
    id,
    name: id,
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
