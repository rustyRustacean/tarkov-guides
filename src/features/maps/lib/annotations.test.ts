import { describe, expect, it } from "vitest";

import {
  addLock,
  addStroke,
  clearLayer,
  DEFAULT_STROKE_COLOR,
  DRAW_COLOR_PRESETS,
  eraserSizeFor,
  eraseNear,
  isStrokeLocked,
  removeLock,
  STROKE_WIDTH_DEFAULT,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
  undoStroke,
} from "./annotations";

import type { LockRect, MapAnnotationLayer, Stroke } from "../types";

function pen(id: string, points: readonly { fx: number; fy: number }[]): Stroke {
  return { id, type: "pen", color: "#ff3b3b", width: 4, points };
}

function circle(id: string, center: { fx: number; fy: number }): Stroke {
  return { id, type: "circle", color: "#ff3b3b", width: 4, center, edge: center };
}

function emptyLayer(): MapAnnotationLayer {
  return { strokes: [], locks: [] };
}

describe("constants", () => {
  it("match confirmed legacy values exactly", () => {
    expect(STROKE_WIDTH_MIN).toBe(1);
    expect(STROKE_WIDTH_MAX).toBe(48);
    expect(STROKE_WIDTH_DEFAULT).toBe(4);
    expect(DRAW_COLOR_PRESETS).toEqual(["#ff3b3b", "#3b86ff", "#ffd83b", "#3bd85a"]);
    expect(DEFAULT_STROKE_COLOR).toBe("#ff3b3b");
  });

  it("eraserSizeFor rounds width * 2.5", () => {
    expect(eraserSizeFor(4)).toBe(10);
    expect(eraserSizeFor(48)).toBe(120);
    expect(eraserSizeFor(1)).toBe(3);
  });
});

describe("isStrokeLocked", () => {
  const lock: LockRect = { id: "l1", corner1: { fx: 0.2, fy: 0.2 }, corner2: { fx: 0.4, fy: 0.4 } };

  it("returns false with no locks at all", () => {
    expect(isStrokeLocked(pen("s1", [{ fx: 0.3, fy: 0.3 }]), [])).toBe(false);
  });

  it("a pen stroke is locked if ANY point falls inside ANY lock", () => {
    const strokeInside = pen("s1", [
      { fx: 0.9, fy: 0.9 },
      { fx: 0.3, fy: 0.3 },
    ]);
    const strokeOutside = pen("s2", [{ fx: 0.9, fy: 0.9 }]);
    expect(isStrokeLocked(strokeInside, [lock])).toBe(true);
    expect(isStrokeLocked(strokeOutside, [lock])).toBe(false);
  });

  it("a circle stroke is locked only by its CENTER - the edge/radius is ignored", () => {
    const centerInside = circle("c1", { fx: 0.3, fy: 0.3 });
    const centerOutside: Stroke = {
      id: "c2",
      type: "circle",
      color: "#fff",
      width: 4,
      center: { fx: 0.9, fy: 0.9 },
      edge: { fx: 0.3, fy: 0.3 }, // edge overlaps the lock, center does not
    };
    expect(isStrokeLocked(centerInside, [lock])).toBe(true);
    expect(isStrokeLocked(centerOutside, [lock])).toBe(false);
  });

  it("handles a drag'd in either corner order", () => {
    const reversedLock: LockRect = {
      id: "l2",
      corner1: { fx: 0.4, fy: 0.4 },
      corner2: { fx: 0.2, fy: 0.2 },
    };
    expect(isStrokeLocked(pen("s1", [{ fx: 0.3, fy: 0.3 }]), [reversedLock])).toBe(true);
  });
});

describe("addStroke", () => {
  it("appends to the strokes array", () => {
    const layer = addStroke(emptyLayer(), pen("s1", [{ fx: 0.1, fy: 0.1 }]));
    expect(layer.strokes).toHaveLength(1);
    expect(layer.strokes[0]?.id).toBe("s1");
  });
});

describe("undoStroke", () => {
  it("removes the most recent stroke", () => {
    const layer: MapAnnotationLayer = {
      strokes: [pen("s1", [{ fx: 0, fy: 0 }]), pen("s2", [{ fx: 0, fy: 0 }])],
      locks: [],
    };
    const result = undoStroke(layer);
    expect(result.strokes.map((s) => s.id)).toEqual(["s1"]);
  });

  it("skips a locked most-recent stroke and removes the next unlocked one", () => {
    const lock: LockRect = {
      id: "l1",
      corner1: { fx: 0.4, fy: 0.4 },
      corner2: { fx: 0.6, fy: 0.6 },
    };
    const layer: MapAnnotationLayer = {
      strokes: [pen("unlocked", [{ fx: 0.9, fy: 0.9 }]), pen("locked", [{ fx: 0.5, fy: 0.5 }])],
      locks: [lock],
    };
    const result = undoStroke(layer);
    expect(result.strokes.map((s) => s.id)).toEqual(["locked"]);
  });

  it("is a no-op when every stroke is locked", () => {
    const lock: LockRect = { id: "l1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 1, fy: 1 } };
    const layer: MapAnnotationLayer = {
      strokes: [pen("s1", [{ fx: 0.5, fy: 0.5 }])],
      locks: [lock],
    };
    expect(undoStroke(layer)).toEqual(layer);
  });

  it("is a no-op on an empty layer", () => {
    expect(undoStroke(emptyLayer())).toEqual(emptyLayer());
  });
});

describe("clearLayer - toggle-morph", () => {
  it("first call stashes unlocked strokes and keeps locked ones in the layer", () => {
    const lock: LockRect = { id: "l1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 0.5, fy: 0.5 } };
    const layer: MapAnnotationLayer = {
      strokes: [pen("locked", [{ fx: 0.1, fy: 0.1 }]), pen("unlocked", [{ fx: 0.9, fy: 0.9 }])],
      locks: [lock],
    };

    const result = clearLayer(layer, null);

    expect(result.layer.strokes.map((s) => s.id)).toEqual(["locked"]);
    expect(result.layer.locks).toEqual([lock]);
    expect(result.stash?.map((s) => s.id)).toEqual(["unlocked"]);
  });

  it("second call (passing the stash back) restores the stashed strokes and clears the stash", () => {
    const lock: LockRect = { id: "l1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 0.5, fy: 0.5 } };
    const original: MapAnnotationLayer = {
      strokes: [pen("locked", [{ fx: 0.1, fy: 0.1 }]), pen("unlocked", [{ fx: 0.9, fy: 0.9 }])],
      locks: [lock],
    };

    const firstClear = clearLayer(original, null);
    const restored = clearLayer(firstClear.layer, firstClear.stash);

    expect(restored.stash).toBeNull();
    expect(restored.layer.strokes.map((s) => s.id).sort()).toEqual(["locked", "unlocked"]);
  });
});

describe("addLock / removeLock", () => {
  it("adds a lock rect", () => {
    const lock: LockRect = { id: "l1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 1, fy: 1 } };
    expect(addLock(emptyLayer(), lock).locks).toEqual([lock]);
  });

  it("removes a lock rect by id", () => {
    const lock: LockRect = { id: "l1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 1, fy: 1 } };
    const layer: MapAnnotationLayer = { strokes: [], locks: [lock] };
    expect(removeLock(layer, "l1").locks).toEqual([]);
  });
});

describe("eraseNear - vector delete-on-drag", () => {
  it("leaves an untouched stroke's id/reference intact", () => {
    const stroke = pen("s1", [{ fx: 0.9, fy: 0.9 }]);
    const layer: MapAnnotationLayer = { strokes: [stroke], locks: [] };
    const result = eraseNear(
      layer,
      () => false,
      () => "unused",
    );
    expect(result.strokes[0]).toBe(stroke);
  });

  it("drops a circle stroke whose center is near the erase path", () => {
    const layer: MapAnnotationLayer = { strokes: [circle("c1", { fx: 0.5, fy: 0.5 })], locks: [] };
    const result = eraseNear(
      layer,
      (point) => point.fx === 0.5 && point.fy === 0.5,
      () => "unused",
    );
    expect(result.strokes).toEqual([]);
  });

  it("drops a whole pen stroke that has fewer than 2 surviving points", () => {
    const stroke = pen("s1", [{ fx: 0.5, fy: 0.5 }]);
    const layer: MapAnnotationLayer = { strokes: [stroke], locks: [] };
    const result = eraseNear(
      layer,
      (point) => point.fx === 0.5,
      () => "unused",
    );
    expect(result.strokes).toEqual([]);
  });

  it("splits a pen stroke in two when an interior point is erased", () => {
    const stroke = pen("s1", [
      { fx: 0, fy: 0 },
      { fx: 0.1, fy: 0 },
      { fx: 0.5, fy: 0 }, // erased - the split point
      { fx: 0.9, fy: 0 },
      { fx: 1, fy: 0 },
    ]);
    const layer: MapAnnotationLayer = { strokes: [stroke], locks: [] };
    let nextId = 0;
    const result = eraseNear(
      layer,
      (point) => point.fx === 0.5,
      () => `generated-${String(nextId++)}`,
    );

    expect(result.strokes).toHaveLength(2);
    expect(result.strokes[0]).toMatchObject({
      id: "generated-0",
      points: [
        { fx: 0, fy: 0 },
        { fx: 0.1, fy: 0 },
      ],
    });
    expect(result.strokes[1]).toMatchObject({
      id: "generated-1",
      points: [
        { fx: 0.9, fy: 0 },
        { fx: 1, fy: 0 },
      ],
    });
  });

  it("erases a locked stroke just as readily as an unlocked one - locks only protect undo/clear", () => {
    const stroke = pen("locked", [{ fx: 0.5, fy: 0.5 }]);
    const lock: LockRect = { id: "l1", corner1: { fx: 0, fy: 0 }, corner2: { fx: 1, fy: 1 } };
    const layer: MapAnnotationLayer = { strokes: [stroke], locks: [lock] };
    const result = eraseNear(
      layer,
      () => true,
      () => "unused",
    );
    expect(result.strokes).toEqual([]);
  });
});
