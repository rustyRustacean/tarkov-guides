"use client";

import { useEffect, useRef, useState } from "react";

import { useUndoableState } from "@/shared/lib/use-undoable-state";
import { toast } from "@/shared/ui/toast/toast-store";

import { toggleKappaGotPatch } from "../lib/kappa";
import { useProgressTrackerStore } from "../store";

const TRANSITION_HOLD_MS = 1500;

interface KappaUndoSnapshot {
  itemId: string;
  wasGot: boolean;
}

export interface UseKappaTrackerResult {
  toggle: (itemId: string, itemName: string) => void;
  /**
   * Items just marked got, still mid transition-hold - render a distinct
   * "securing" state instead of the settled done state, and keep them
   * sorted as if still un-got until the hold expires. Purely visual, never
   * persisted, not part of the undo snapshot.
   */
  justGotIds: ReadonlySet<string>;
}

/**
 * Kappa/hideout stockpiling checklist toggle, ported from
 * `old/TarkovTrackerWB-main/src/components/kappa/kappa.js`. `maxDepth: 100`
 * matches that file's `_kappaUndoStack` cap exactly (vs. task-actions'/
 * raid-commit's `1`) - kappa hoarding happens over many individual clicks
 * across a long play session, so a deeper undo history is warranted.
 *
 * Also ports kappa.js's transition hold: marking an item got doesn't
 * instantly re-sort it to the bottom of the checklist - a `setTimeout`
 * keeps it in `justGotIds` for `TRANSITION_HOLD_MS` so the user sees their
 * click land before the item slides away. The real duration is 1500ms
 * (kappa.js's own code comments say "3 seconds," but its actual constant is
 * `KAPPA_TRANSITION_MS = 1500` - the comments are stale). Un-getting is
 * always immediate, matching legacy exactly. This is purely visual -
 * `kappaGot` is written to the store synchronously either way - and is
 * never part of the undo snapshot; undoing a toggle also cancels any
 * in-flight hold for that item (matches legacy's `undoKappaGot`).
 */
export function useKappaTracker(): UseKappaTrackerResult {
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const setKappaGot = useProgressTrackerStore((state) => state.setKappaGot);

  const [justGotIds, setJustGotIds] = useState<ReadonlySet<string>>(new Set());
  const timeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Ref-only cleanup (no setState here, matching `use-undoable-state.ts`'s
  // established resolution of this exact lint constraint) - cancels any
  // in-flight hold timers on profile switch or unmount. `justGotIds` itself
  // is left as-is: a stale id from a previous profile simply won't match
  // any item rendered under the new profile, so it's harmless dead state.
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      for (const handle of timeouts.values()) clearTimeout(handle);
      timeouts.clear();
    };
  }, [activeProfileId]);

  function clearHold(itemId: string): void {
    const handle = timeoutsRef.current.get(itemId);
    if (handle !== undefined) {
      clearTimeout(handle);
      timeoutsRef.current.delete(itemId);
    }
    setJustGotIds((current) => {
      if (!current.has(itemId)) return current;
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }

  function startHold(itemId: string): void {
    clearHold(itemId);
    setJustGotIds((current) => new Set(current).add(itemId));
    const handle = setTimeout(() => {
      timeoutsRef.current.delete(itemId);
      setJustGotIds((current) => {
        if (!current.has(itemId)) return current;
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
    }, TRANSITION_HOLD_MS);
    timeoutsRef.current.set(itemId, handle);
  }

  const undoable = useUndoableState<KappaUndoSnapshot>({
    maxDepth: 100,
    scopeKey: activeProfileId,
    apply: (snapshot) => {
      setKappaGot(snapshot.itemId, snapshot.wasGot);
      clearHold(snapshot.itemId);
    },
  });

  function toggle(itemId: string, itemName: string): void {
    if (!progress) return;
    const wasGot = progress.kappaGot[itemId] === true;
    undoable.push({ itemId, wasGot });

    const nextKappaGot = toggleKappaGotPatch(progress.kappaGot, itemId);
    const nowGot = nextKappaGot[itemId] === true;
    setKappaGot(itemId, nowGot);

    if (nowGot) {
      startHold(itemId);
    } else {
      clearHold(itemId);
    }

    toast({
      message: `${nowGot ? "Got" : "Un-got"}: ${itemName}`,
      action: { label: "UNDO", onClick: () => undoable.undo() },
    });
  }

  return { toggle, justGotIds };
}
