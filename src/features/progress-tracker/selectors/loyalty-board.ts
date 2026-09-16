import { LOYALTY_BOARD_OVERRIDES } from "../data/loyalty-board-overrides";

import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export type LoyaltyBucket = "essential" | 1 | 2 | 3 | 4 | "unconfirmed";

/** Row order top-to-bottom for the Matrix/Accordion views, and layer order for the repurposed Tree. */
export const LOYALTY_BUCKET_ORDER: readonly LoyaltyBucket[] = [
  "essential",
  1,
  2,
  3,
  4,
  "unconfirmed",
];

const LOYALTY_BUCKET_LABEL: Readonly<Record<LoyaltyBucket, string>> = {
  essential: "Essential",
  1: "Loyalty Level 1",
  2: "Loyalty Level 2",
  3: "Loyalty Level 3",
  4: "Loyalty Level 4",
  unconfirmed: "Unconfirmed",
};

/** A bucket's position in `LOYALTY_BUCKET_ORDER`, for use as `computeQuestTreeLayout`'s `layerByTaskId` values. */
export function loyaltyBucketLayer(bucket: LoyaltyBucket): number {
  return LOYALTY_BUCKET_ORDER.indexOf(bucket);
}

/** Human-readable row label for a bucket ("Essential", "Loyalty Level 2", "Unconfirmed"). */
export function loyaltyBucketLabel(bucket: LoyaltyBucket): string {
  return LOYALTY_BUCKET_LABEL[bucket];
}

export interface LoyaltyBoardEntry {
  taskId: string;
  bucket: LoyaltyBucket;
  /** Only ever true via a curated override entry in `loyalty-board-overrides.ts`, never derived from `kappaRequired`. */
  essential: boolean;
  source: "curated" | "api" | "unconfirmed";
}

/**
 * Resolves a task's board placement with this precedence, deliberately
 * never falling back to `minPlayerLevel` (confirmed unreliable: real LL4
 * tasks like Prapor's "Best Job in the World" carry `minPlayerLevel: 0`
 * with zero API requirements):
 *
 * 1. A curated override (`loyalty-board-overrides.ts`), hand-verified
 *    against a real screenshot. `essential: true` always wins the final
 *    bucket (the Essential row), even if the same entry also carries a
 *    `loyaltyLevel`: BSG's own UI treats the two as mutually exclusive
 *    sections.
 * 2. The task's own `traderRequirements` "level" entry for its own trader,
 *    when present. Confirmed to match every real screenshot checked so
 *    far, just not yet curated for every trader.
 * 3. `"unconfirmed"`: an explicit bucket, not a guess.
 */
export function resolveLoyaltyBoardEntry(task: NormalizedTask): LoyaltyBoardEntry {
  const override = LOYALTY_BOARD_OVERRIDES[task.id];
  if (override) {
    const bucket: LoyaltyBucket = override.essential
      ? "essential"
      : (override.loyaltyLevel ?? "unconfirmed");
    return { taskId: task.id, bucket, essential: override.essential === true, source: "curated" };
  }

  const ownLevelRequirement = task.traderRequirements.find(
    (requirement) =>
      requirement.requirementType === "level" && requirement.traderId === task.trader.id,
  );
  if (ownLevelRequirement && ownLevelRequirement.value >= 1 && ownLevelRequirement.value <= 4) {
    return {
      taskId: task.id,
      bucket: ownLevelRequirement.value as 1 | 2 | 3 | 4,
      essential: false,
      source: "api",
    };
  }

  return { taskId: task.id, bucket: "unconfirmed", essential: false, source: "unconfirmed" };
}

/** `resolveLoyaltyBoardEntry` applied to every task, keyed by task id, for O(1) lookup by the board views. */
export function buildLoyaltyBoard(
  tasks: readonly NormalizedTask[],
): ReadonlyMap<string, LoyaltyBoardEntry> {
  const board = new Map<string, LoyaltyBoardEntry>();
  for (const task of tasks) {
    board.set(task.id, resolveLoyaltyBoardEntry(task));
  }
  return board;
}
