import { describe, expect, it } from "vitest";

import { diffAnnotationLayer, findOwnStrokeToUndo } from "./session-annotations";

import type { MapAnnotationLayer, Stroke } from "../types";

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
    expect(findOwnStrokeToUndo(strokes, "bob")).toBeNull();
  });

  it("picks the author's most recent stroke, ignoring others' more recent ones", () => {
    const strokes = [pen("1", "alice", 1), pen("2", "bob", 5), pen("3", "alice", 3)];
    expect(findOwnStrokeToUndo(strokes, "alice")?.id).toBe("3");
  });
});

describe("diffAnnotationLayer", () => {
  const empty: MapAnnotationLayer = { strokes: [] };

  it("reports no changes for identical layers", () => {
    const layer: MapAnnotationLayer = { strokes: [pen("1", "alice", 1)] };
    expect(diffAnnotationLayer(layer, layer)).toEqual({ addedStrokes: [], removedStrokeIds: [] });
  });

  it("detects an added stroke", () => {
    const stroke = pen("1", "alice", 1);
    const diff = diffAnnotationLayer(empty, { strokes: [stroke] });
    expect(diff.addedStrokes).toEqual([stroke]);
    expect(diff.removedStrokeIds).toEqual([]);
  });

  it("detects a removed stroke", () => {
    const stroke = pen("1", "alice", 1);
    const diff = diffAnnotationLayer({ strokes: [stroke] }, empty);
    expect(diff.removedStrokeIds).toEqual(["1"]);
    expect(diff.addedStrokes).toEqual([]);
  });

  it("detects a stroke split (erase): original id removed, new ids added", () => {
    const original = pen("1", "alice", 1);
    const splitA = pen("2", "alice", 2);
    const splitB = pen("3", "alice", 2);
    const diff = diffAnnotationLayer({ strokes: [original] }, { strokes: [splitA, splitB] });
    expect(diff.removedStrokeIds).toEqual(["1"]);
    expect(diff.addedStrokes.map((s) => s.id).sort()).toEqual(["2", "3"]);
  });

  it("treats a move/rotate commit (same id, changed geometry) as remove-old-add-new, not an in-place update", () => {
    const original = pen("1", "alice", 1, { fx: 0.1, fy: 0.1 });
    const moved = pen("2", "alice", 1, { fx: 0.5, fy: 0.5 });
    const diff = diffAnnotationLayer({ strokes: [original] }, { strokes: [moved] });
    expect(diff.removedStrokeIds).toEqual(["1"]);
    expect(diff.addedStrokes).toEqual([moved]);
  });
});
