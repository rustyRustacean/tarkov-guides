"use client";

import { useUndoableState } from "@/shared/lib/use-undoable-state";
import { toast } from "@/shared/ui/toast/toast-store";

import { cancelRaid, confirmRaid } from "../lib/item-tracking";
import { useProgressTrackerStore } from "../store";

import { useActiveProgress } from "./use-active-progress";

import type { RaidCommitResult } from "../lib/item-tracking";

function pluralize(count: number, singular: string): string {
  return `${String(count)} ${singular}${count === 1 ? "" : "s"}`;
}

export interface UseRaidCommitResult {
  extract: () => void;
  die: () => void;
}

/**
 * DIED/EXTRACTED, wiring `lib/item-tracking.ts`'s `confirmRaid`/`cancelRaid`
 * (ported from `old/TarkovTrackerWB-main/src/components/items/itemAdjust.js`)
 * to the store. Unlike legacy, which has no undo for this at all, this gains
 * a one-level undo (toast UNDO, `maxDepth: 1`, scoped to `activeProfileId`
 * so switching profiles clears the stack, matching the other two
 * `useUndoableState` consumers): a deliberate scope addition, not a parity
 * port. No secure-container partial-loss modeling on DIED: `cancelRaid`
 * discards `pending` unconditionally, matching legacy's default.
 */
export function useRaidCommit(): UseRaidCommitResult {
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useActiveProgress();
  const replaceHaveAndPending = useProgressTrackerStore((state) => state.replaceHaveAndPending);

  const undoable = useUndoableState<RaidCommitResult>({
    scopeKey: activeProfileId,
    apply: (snapshot) => {
      replaceHaveAndPending(snapshot.have, snapshot.pending);
    },
  });

  function withUndoToast(message: string): void {
    toast({ message, action: { label: "UNDO", onClick: () => undoable.undo() } });
  }

  function extract(): void {
    if (!progress) return;
    undoable.push({ have: progress.have, pending: progress.pending });

    const movedCount = Object.values(progress.pending).reduce((sum, n) => sum + n, 0);
    const result = confirmRaid(progress.have, progress.pending);
    replaceHaveAndPending(result.have, result.pending);

    withUndoToast(
      movedCount > 0 ? `Extracted - ${pluralize(movedCount, "item")} moved to stash` : "Extracted",
    );
  }

  function die(): void {
    if (!progress) return;
    undoable.push({ have: progress.have, pending: progress.pending });

    const lostCount = Object.values(progress.pending).reduce((sum, n) => sum + n, 0);
    const result = cancelRaid(progress.have);
    replaceHaveAndPending(result.have, result.pending);

    withUndoToast(lostCount > 0 ? `Died - ${pluralize(lostCount, "item")} lost` : "Died");
  }

  return { extract, die };
}
