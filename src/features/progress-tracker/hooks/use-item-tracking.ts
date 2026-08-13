"use client";

import { toast } from "@/shared/ui/toast/toast-store";

import {
  adjustPending as adjustPendingReducer,
  editStash as editStashReducer,
  fillMoneyPending,
  removeCustomItemEntry,
  upsertCustomItem,
} from "../lib/item-tracking";
import { useProgressTrackerStore } from "../store";

import { useActiveProgress } from "./use-active-progress";

export interface UseItemTrackingResult {
  /** Adjusts a this-raid pending count by a signed delta (the +/- stepper). No toast; too high-frequency. */
  adjustPending: (itemId: string, delta: number) => void;
  /** Directly sets a stash count. Toasts, unlike {@link adjustPending}: a deliberate, low-frequency edit. */
  editStash: (itemId: string, name: string, count: number) => void;
  /** Nudges a stash count by a signed delta (the +/- stepper). Silent, like {@link adjustPending}. */
  adjustStash: (itemId: string, delta: number) => void;
  /** Money-item whole-amount fill/clear (direction 1 fills to remaining, -1 clears). No toast, matching legacy. */
  fillMoney: (itemId: string, need: number, direction: 1 | -1) => void;
  /** Adds a custom item (or updates `need` in place if already tracked by this real item id), optionally bumping `have`. */
  addCustomItem: (
    item: { id: string; name: string; iconLink: string | null },
    need: number,
    haveInitial: number,
  ) => void;
  removeCustomItem: (id: string, name: string) => void;
}

/**
 * Thin wiring between `lib/item-tracking.ts`'s pure reducers and the store's
 * `have`/`pending`/`customItems` setters. Deliberately has no
 * `useUndoableState` instance: only task actions, kappa, and raid-commit get
 * an undo stack, since these are high-frequency stash edits with no undo in
 * legacy either.
 */
export function useItemTracking(): UseItemTrackingResult {
  const progress = useActiveProgress();
  const setHave = useProgressTrackerStore((state) => state.setHave);
  const setPending = useProgressTrackerStore((state) => state.setPending);
  const setCustomItems = useProgressTrackerStore((state) => state.setCustomItems);

  function adjustPending(itemId: string, delta: number): void {
    if (!progress) return;
    const next = adjustPendingReducer(progress.pending, itemId, delta);
    setPending(itemId, next[itemId] ?? 0);
  }

  function editStash(itemId: string, name: string, count: number): void {
    if (!progress) return;
    const next = editStashReducer(progress.have, itemId, count);
    const clamped = next[itemId] ?? 0;
    setHave(itemId, clamped);
    toast({ message: `Stash updated: ${name} → ${String(clamped)}` });
  }

  /**
   * The stepper's +/-. Shares `editStashReducer` (and so its clamping) with
   * {@link editStash} but stays silent: a toast per click was fine when the
   * only way to change a stash count was typing a new one, and is noise now
   * that a count can be nudged one at a time.
   */
  function adjustStash(itemId: string, delta: number): void {
    if (!progress) return;
    const current = progress.have[itemId] ?? 0;
    const next = editStashReducer(progress.have, itemId, current + delta);
    setHave(itemId, next[itemId] ?? 0);
  }

  function fillMoney(itemId: string, need: number, direction: 1 | -1): void {
    if (!progress) return;
    const next = fillMoneyPending(progress.pending, progress.have, itemId, need, direction);
    setPending(itemId, next[itemId] ?? 0);
  }

  function addCustomItem(
    item: { id: string; name: string; iconLink: string | null },
    need: number,
    haveInitial: number,
  ): void {
    if (!progress) return;
    const alreadyTracked = progress.customItems.some((entry) => entry.id === item.id);
    setCustomItems(upsertCustomItem(progress.customItems, item, need));
    if (haveInitial > 0) {
      setHave(item.id, (progress.have[item.id] ?? 0) + haveInitial);
    }
    toast({
      message: alreadyTracked
        ? `${item.name}: need updated to ${String(need)}`
        : `Added ${item.name} · need ${String(need)}`,
    });
  }

  function removeCustomItem(id: string, name: string): void {
    if (!progress) return;
    setCustomItems(removeCustomItemEntry(progress.customItems, id));
    toast({ message: `Removed ${name} from custom items` });
  }

  return { adjustPending, editStash, adjustStash, fillMoney, addCustomItem, removeCustomItem };
}
