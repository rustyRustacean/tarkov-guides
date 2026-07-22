import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUndoableState } from "./use-undoable-state";

describe("useUndoableState", () => {
  it("starts with canUndo false and undo() as a no-op", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useUndoableState({ scopeKey: "profile-1", apply }));
    expect(result.current.canUndo).toBe(false);
    act(() => {
      expect(result.current.undo()).toBe(false);
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("push then undo restores the exact pushed snapshot via apply", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useUndoableState({ scopeKey: "profile-1", apply }));
    act(() => {
      result.current.push({ have: { a: 1 } });
    });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      const undone = result.current.undo();
      expect(undone).toBe(true);
    });
    expect(apply).toHaveBeenCalledExactlyOnceWith({ have: { a: 1 } });
    expect(result.current.canUndo).toBe(false);
  });

  it("defaults maxDepth to 1 - a second push replaces the first, only the newest is restorable", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useUndoableState({ scopeKey: "profile-1", apply }));
    act(() => {
      result.current.push({ n: 1 });
      result.current.push({ n: 2 });
    });
    act(() => {
      result.current.undo();
    });
    expect(apply).toHaveBeenCalledExactlyOnceWith({ n: 2 });
    act(() => {
      expect(result.current.undo()).toBe(false);
    });
  });

  it("respects a larger maxDepth (matches kappa.js's 100-entry stack), FIFO-evicting past it", () => {
    const apply = vi.fn();
    const { result } = renderHook(() =>
      useUndoableState({ scopeKey: "profile-1", apply, maxDepth: 2 }),
    );
    act(() => {
      result.current.push({ n: 1 });
      result.current.push({ n: 2 });
      result.current.push({ n: 3 });
    });
    act(() => {
      result.current.undo();
    });
    expect(apply).toHaveBeenLastCalledWith({ n: 3 });
    act(() => {
      result.current.undo();
    });
    expect(apply).toHaveBeenLastCalledWith({ n: 2 });
    // { n: 1 } was evicted once the stack exceeded maxDepth=2.
    act(() => {
      expect(result.current.undo()).toBe(false);
    });
  });

  it("clears the stack when scopeKey changes - the fix for the confirmed cross-profile undo-corruption bug", () => {
    const apply = vi.fn();
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string | null }) => useUndoableState({ scopeKey, apply }),
      { initialProps: { scopeKey: "profile-a" } },
    );
    act(() => {
      result.current.push({ owner: "profile-a" });
    });
    expect(result.current.canUndo).toBe(true);

    rerender({ scopeKey: "profile-b" });
    expect(result.current.canUndo).toBe(false);

    act(() => {
      expect(result.current.undo()).toBe(false);
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("a pre-push-captured undo reference still sees a push that happens in the same synchronous call - regression test for a real stale-closure bug", () => {
    // Mirrors how a consumer actually uses this hook: capture `undo` (e.g.
    // to hand to a toast's `action.onClick`, which is stored outside React
    // and never "refreshes" to a later render), THEN call `push()` in the
    // same synchronous function, THEN invoke the pre-push-captured `undo`.
    // A `useState`-backed stack fails this: `undo`'s closure is bound to
    // the PRE-push (empty) stack value from the render where it was read,
    // since `setStack` doesn't apply until the next render - so the
    // captured reference can never see the push. This was caught via a
    // real downstream bug in `useTaskActions`'s `startTask`, not by any of
    // the tests above (all of which call `push` and `undo` across
    // separate `act()` blocks, allowing a re-render in between).
    const apply = vi.fn();
    const { result } = renderHook(() => useUndoableState({ scopeKey: "profile-1", apply }));

    const undoBeforePush = result.current.undo;
    act(() => {
      result.current.push({ n: 1 });
      const undone = undoBeforePush();
      expect(undone).toBe(true);
    });

    expect(apply).toHaveBeenCalledExactlyOnceWith({ n: 1 });
  });

  it("a stale undo captured before unmount is a no-op after unmount - regression test for the cross-profile corruption bug", () => {
    // Mirrors the real repro: a component holding this hook unmounts (e.g.
    // a Radix `Tabs` tab switch) while a toast built from an earlier render
    // still holds a reference to `undo`. Without unmount cleanup, that
    // stale `undo` would still see the pushed snapshot and call `apply` -
    // which every real consumer resolves against whatever profile is
    // ACTIVE NOW, not the one that was active at push time.
    const apply = vi.fn();
    const { result, unmount } = renderHook(() =>
      useUndoableState({ scopeKey: "profile-a", apply }),
    );
    act(() => {
      result.current.push({ owner: "profile-a" });
    });
    const staleUndo = result.current.undo;

    unmount();

    act(() => {
      expect(staleUndo()).toBe(false);
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("clear() empties the stack imperatively", () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useUndoableState({ scopeKey: "profile-1", apply }));
    act(() => {
      result.current.push({ n: 1 });
      result.current.clear();
    });
    expect(result.current.canUndo).toBe(false);
  });
});
