"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseUndoableStateOptions<TSnapshot> {
  /**
   * Max entries kept, FIFO-evicted once exceeded. `1` matches legacy
   * `taskActions.js`'s single-level `_lastMutation` buffer; `100` matches
   * legacy `kappa.js`'s `_kappaUndoStack`. Defaults to `1`.
   */
  maxDepth?: number;
  /**
   * When this value changes between renders, the stack is cleared. Pass the
   * active profile id here - this is the fix for a confirmed real legacy bug
   * where `kappa.js`'s undo stack isn't cleared on profile switch, so
   * hitting undo after switching profiles pops a mutation recorded against
   * the OLD profile and silently applies it to the new one.
   */
  scopeKey: string | null;
  /** How to restore a popped snapshot back into external state (e.g. a Zustand store setter). */
  apply: (snapshot: TSnapshot) => void;
}

export interface UseUndoableState<TSnapshot> {
  /** Call BEFORE mutating, with the PRE-mutation snapshot. */
  push: (snapshot: TSnapshot) => void;
  /** Pops the most recent entry and calls `apply`. Returns `false` (no-op) if the stack is empty. */
  undo: () => boolean;
  canUndo: boolean;
  clear: () => void;
}

/**
 * A small, generic undo-stack hook - in-memory only (matches both legacy
 * undo mechanisms it replaces: neither `_lastMutation` nor
 * `_kappaUndoStack` was ever persisted, both reset on page reload).
 * Cross-cutting (not Progress-Tracker-specific): the master migration plan
 * calls out this exact pattern as useful for item/hideout tracking too.
 *
 * The stack lives in a ref, not `useState` - a real bug surfaced this: a
 * caller that calls `push()` and then immediately (same synchronous call)
 * hands `undo` to a toast's `action.onClick` needs that later click to see
 * the just-pushed entry. With a `useState`-backed stack, `undo`'s closure
 * is bound to whatever `stack` value existed at the render where the toast
 * was built - which is the PRE-push value, since `setStack` doesn't apply
 * until the next render. The toast's `onClick` is stored in an external
 * (non-React) store and never "refreshes" to a later render's closure, so
 * the bug is permanent for that toast, not just a one-render glitch. A ref
 * sidesteps this: `undo()`'s body reads `stackRef.current` live, at CALL
 * time, regardless of which render created the specific `undo` function
 * instance being invoked.
 *
 * This project's stricter, React Compiler-oriented lint rules
 * (`react-hooks/refs`, `react-hooks/set-state-in-effect`) forbid reading/
 * writing a ref during the render BODY and forbid calling `setState`
 * inside a bare `useEffect` - neither applies here: the ref is only ever
 * touched inside callbacks (`push`/`undo`/`clear`) or inside an effect that
 * itself contains no `setState` call (the scope-reset effect below only
 * mutates the ref; `canUndo`'s reset uses the separate, render-body
 * "adjusting state when a prop changes" pattern instead, same as before).
 */
export function useUndoableState<TSnapshot>(
  options: UseUndoableStateOptions<TSnapshot>,
): UseUndoableState<TSnapshot> {
  const { maxDepth = 1, scopeKey, apply } = options;
  const stackRef = useRef<TSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [previousScopeKey, setPreviousScopeKey] = useState(scopeKey);

  if (scopeKey !== previousScopeKey) {
    setPreviousScopeKey(scopeKey);
    setCanUndo(false);
  }

  // Ref-only reset (no setState here) - paired with the render-body
  // `canUndo` reset above rather than combined into one effect, since this
  // project's lint rules forbid a `setState` call inside a bare effect.
  // The cleanup (also ref-only, still no setState) closes a real
  // cross-profile corruption gap: this hook's owning component can unmount
  // (e.g. a tab switch, since Radix `Tabs` unmounts inactive content)
  // without `scopeKey` ever changing on this instance, leaving a stale
  // `undo` reference alive inside an already-fired toast's `onClick`. If
  // the stack isn't cleared, invoking that stale `undo` after switching to
  // a DIFFERENT profile applies the old profile's snapshot against
  // whatever profile is live NOW (every consumer's `apply` resolves the
  // target profile at call time, not push time) - silently overwriting the
  // new profile's progress. Clearing on unmount makes a stale `undo()`
  // correctly a no-op instead.
  useEffect(() => {
    stackRef.current = [];
    return () => {
      stackRef.current = [];
    };
  }, [scopeKey]);

  const push = useCallback(
    (snapshot: TSnapshot) => {
      stackRef.current = [...stackRef.current, snapshot].slice(-maxDepth);
      setCanUndo(true);
    },
    [maxDepth],
  );

  const undo = useCallback((): boolean => {
    const stack = stackRef.current;
    const lastSnapshot = stack[stack.length - 1];
    if (lastSnapshot === undefined) return false;
    stackRef.current = stack.slice(0, -1);
    setCanUndo(stackRef.current.length > 0);
    apply(lastSnapshot);
    return true;
  }, [apply]);

  const clear = useCallback(() => {
    stackRef.current = [];
    setCanUndo(false);
  }, []);

  return { push, undo, canUndo, clear };
}
