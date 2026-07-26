import { describe, expect, it } from "vitest";

import { diffAnnotationLayer, findOwnStrokeToUndo } from "./session-annotations";

import type { LockRect, MapAnnotationLayer, Stroke } from "../types";

function pen(
  id: string,
  authorId: string,
  createdAt: number,
  point: { fx: number; fy: number } = { fx: 0, fy: 0 },
): Stroke {
  return { id, type: "pen", color: "#ff3b3b", width: 4, authorId, createdAt, points: [point] };
}

describe("findOwnStrokeToUndo", () => {
  it("returns null when the author has no strokes", () => {
    const strokes = [pen("1", "alice", 1)];
    expect(findOwnStrokeToUndo(strokes, [], "bob")).toBeNull();
  });

  it("picks the author's most recent stroke, ignoring others' more recent ones", () => {
    const strokes = [pen("1", "alice", 1), pen("2", "bob", 5), pen("3", "alice", 3)];
    expect(findOwnStrokeToUndo(strokes, [], "alice")?.id).toBe("3");
  });

  it("skips a locked stroke even if it's the author's most recent", () => {
    const strokes = [
      pen("1", "alice", 1, { fx: 0.9, fy: 0.9 }),
      pen("2", "alice", 5, { fx: 0.1, fy: 0.1 }),
    ];
    const locks: LockRect[] = [
      { id: "lock-1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 0.5, fy: 0.5 } },
    ];
    expect(findOwnStrokeToUndo(strokes, locks, "alice")?.id).toBe("1");
  });

  it("returns null when every eligible stroke is locked", () => {
    const strokes = [pen("1", "alice", 1)];
    const locks: LockRect[] = [
      { id: "lock-1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 1, fy: 1 } },
    ];
    expect(findOwnStrokeToUndo(strokes, locks, "alice")).toBeNull();
  });
});

describe("diffAnnotationLayer", () => {
  const empty: MapAnnotationLayer = { strokes: [], locks: [] };

  it("reports no changes for identical layers", () => {
    const layer: MapAnnotationLayer = { strokes: [pen("1", "alice", 1)], locks: [] };
    expect(diffAnnotationLayer(layer, layer)).toEqual({
      addedStrokes: [],
      removedStrokeIds: [],
      addedLocks: [],
      removedLockIds: [],
    });
  });

  it("detects an added stroke", () => {
    const stroke = pen("1", "alice", 1);
    const diff = diffAnnotationLayer(empty, { strokes: [stroke], locks: [] });
    expect(diff.addedStrokes).toEqual([stroke]);
    expect(diff.removedStrokeIds).toEqual([]);
  });

  it("detects a removed stroke", () => {
    const stroke = pen("1", "alice", 1);
    const diff = diffAnnotationLayer({ strokes: [stroke], locks: [] }, empty);
    expect(diff.removedStrokeIds).toEqual(["1"]);
    expect(diff.addedStrokes).toEqual([]);
  });

  it("detects a stroke split (erase): original id removed, new ids added", () => {
    const original = pen("1", "alice", 1);
    const splitA = pen("2", "alice", 2);
    const splitB = pen("3", "alice", 2);
    const diff = diffAnnotationLayer(
      { strokes: [original], locks: [] },
      { strokes: [splitA, splitB], locks: [] },
    );
    expect(diff.removedStrokeIds).toEqual(["1"]);
    expect(diff.addedStrokes.map((s) => s.id).sort()).toEqual(["2", "3"]);
  });

  it("detects added/removed locks independently of strokes", () => {
    const lock: LockRect = { id: "lock-1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 1, fy: 1 } };
    const added = diffAnnotationLayer(empty, { strokes: [], locks: [lock] });
    expect(added.addedLocks).toEqual([lock]);

    const removed = diffAnnotationLayer({ strokes: [], locks: [lock] }, empty);
    expect(removed.removedLockIds).toEqual(["lock-1"]);
  });
});
