import { describe, expect, it } from "vitest";

import {
  addStroke,
  clearLayer,
  DEFAULT_STROKE_COLOR,
  DRAW_COLOR_PRESETS,
  eraserSizeFor,
  eraseNear,
  rectCenter,
  replaceStroke,
  STROKE_WIDTH_DEFAULT,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
  translateStroke,
  undoStroke,
} from "./annotations";

import type { MapAnnotationLayer, Stroke } from "../types";

function pen(id: string, points: readonly { fx: number; fy: number }[]): Stroke {
  return { id, type: "pen", color: "#ff3b3b", width: 4, points };
}

function circle(id: string, center: { fx: number; fy: number }): Stroke {
  return { id, type: "circle", color: "#ff3b3b", width: 4, center, edge: center };
}

function rect(
  id: string,
  corner1: { fx: number; fy: number },
  corner2: { fx: number; fy: number },
  rotation = 0,
): Stroke {
  return { id, type: "rect", color: "#ff3b3b", width: 4, corner1, corner2, rotation };
}

function emptyLayer(): MapAnnotationLayer {
  return { strokes: [] };
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

describe("rectCenter", () => {
  it("is the midpoint of the two corners, regardless of drag direction", () => {
    const forward = rectCenter({ corner1: { fx: 0.2, fy: 0.4 }, corner2: { fx: 0.6, fy: 0.8 } });
    expect(forward.fx).toBeCloseTo(0.4);
    expect(forward.fy).toBeCloseTo(0.6);
    const reversed = rectCenter({ corner1: { fx: 0.6, fy: 0.8 }, corner2: { fx: 0.2, fy: 0.4 } });
    expect(reversed.fx).toBeCloseTo(0.4);
    expect(reversed.fy).toBeCloseTo(0.6);
  });
});

describe("addStroke", () => {
  it("appends to the strokes array", () => {
    const layer = addStroke(emptyLayer(), pen("s1", [{ fx: 0.1, fy: 0.1 }]));
    expect(layer.strokes).toHaveLength(1);
    expect(layer.strokes[0]?.id).toBe("s1");
  });
});

describe("replaceStroke", () => {
  it("swaps a stroke's geometry by id for the caller-provided replacement, id included", () => {
    const layer: MapAnnotationLayer = { strokes: [pen("s1", [{ fx: 0, fy: 0 }])] };
    const next = rect("s2", { fx: 0.1, fy: 0.1 }, { fx: 0.2, fy: 0.2 });
    const result = replaceStroke(layer, "s1", next);
    expect(result.strokes).toEqual([next]);
  });

  it("is a no-op when the id isn't found", () => {
    const layer: MapAnnotationLayer = { strokes: [pen("s1", [{ fx: 0, fy: 0 }])] };
    const result = replaceStroke(layer, "missing", rect("s2", { fx: 0, fy: 0 }, { fx: 1, fy: 1 }));
    expect(result.strokes).toEqual(layer.strokes);
  });
});

describe("translateStroke", () => {
  it("shifts every point of a pen stroke by the delta", () => {
    const stroke = pen("s1", [
      { fx: 0.1, fy: 0.1 },
      { fx: 0.2, fy: 0.3 },
    ]);
    const moved = translateStroke(stroke, { fx: 0.1, fy: -0.05 });
    expect(moved.type).toBe("pen");
    if (moved.type !== "pen") throw new Error("unreachable");
    expect(moved.points[0]?.fx).toBeCloseTo(0.2);
    expect(moved.points[0]?.fy).toBeCloseTo(0.05);
    expect(moved.points[1]?.fx).toBeCloseTo(0.3);
    expect(moved.points[1]?.fy).toBeCloseTo(0.25);
  });

  it("shifts a circle's center and edge together", () => {
    const stroke = circle("c1", { fx: 0.5, fy: 0.5 });
    const moved = translateStroke(stroke, { fx: 0.1, fy: 0.1 });
    expect(moved).toMatchObject({ center: { fx: 0.6, fy: 0.6 }, edge: { fx: 0.6, fy: 0.6 } });
  });

  it("shifts a rect's corners, preserving rotation", () => {
    const stroke = rect("r1", { fx: 0.2, fy: 0.2 }, { fx: 0.4, fy: 0.4 }, 30);
    const moved = translateStroke(stroke, { fx: -0.1, fy: 0.2 });
    expect(moved.type).toBe("rect");
    if (moved.type !== "rect") throw new Error("unreachable");
    expect(moved.corner1.fx).toBeCloseTo(0.1);
    expect(moved.corner1.fy).toBeCloseTo(0.4);
    expect(moved.corner2.fx).toBeCloseTo(0.3);
    expect(moved.corner2.fy).toBeCloseTo(0.6);
    expect(moved.rotation).toBe(30);
  });
});

describe("undoStroke", () => {
  it("removes the most recent stroke", () => {
    const layer: MapAnnotationLayer = {
      strokes: [pen("s1", [{ fx: 0, fy: 0 }]), pen("s2", [{ fx: 0, fy: 0 }])],
    };
    const result = undoStroke(layer);
    expect(result.strokes.map((s) => s.id)).toEqual(["s1"]);
  });

  it("is a no-op on an empty layer", () => {
    expect(undoStroke(emptyLayer())).toEqual(emptyLayer());
  });
});

describe("clearLayer - toggle-morph", () => {
  it("first call empties the layer and stashes everything that was in it", () => {
    const layer: MapAnnotationLayer = {
      strokes: [pen("s1", [{ fx: 0.1, fy: 0.1 }]), pen("s2", [{ fx: 0.9, fy: 0.9 }])],
    };

    const result = clearLayer(layer, null);

    expect(result.layer.strokes).toEqual([]);
    expect(result.stash?.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("second call (passing the stash back) restores the stashed strokes and clears the stash", () => {
    const original: MapAnnotationLayer = {
      strokes: [pen("s1", [{ fx: 0.1, fy: 0.1 }]), pen("s2", [{ fx: 0.9, fy: 0.9 }])],
    };

    const firstClear = clearLayer(original, null);
    const restored = clearLayer(firstClear.layer, firstClear.stash);

    expect(restored.stash).toBeNull();
    expect(restored.layer.strokes.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  });
});

describe("eraseNear - vector delete-on-drag", () => {
  it("leaves an untouched stroke's id/reference intact", () => {
    const stroke = pen("s1", [{ fx: 0.9, fy: 0.9 }]);
    const layer: MapAnnotationLayer = { strokes: [stroke] };
    const result = eraseNear(
      layer,
      () => false,
      () => "unused",
    );
    expect(result.strokes[0]).toBe(stroke);
  });

  it("drops a circle stroke whose center is near the erase path", () => {
    const layer: MapAnnotationLayer = { strokes: [circle("c1", { fx: 0.5, fy: 0.5 })] };
    const result = eraseNear(
      layer,
      (point) => point.fx === 0.5 && point.fy === 0.5,
      () => "unused",
    );
    expect(result.strokes).toEqual([]);
  });

  it("drops a rect stroke whose center is near the erase path", () => {
    const layer: MapAnnotationLayer = {
      strokes: [rect("r1", { fx: 0.4, fy: 0.4 }, { fx: 0.6, fy: 0.6 })],
    };
    const result = eraseNear(
      layer,
      (point) => point.fx === 0.5 && point.fy === 0.5,
      () => "unused",
    );
    expect(result.strokes).toEqual([]);
  });

  it("leaves a rect stroke alone when its center isn't near the erase path", () => {
    const stroke = rect("r1", { fx: 0.4, fy: 0.4 }, { fx: 0.6, fy: 0.6 });
    const layer: MapAnnotationLayer = { strokes: [stroke] };
    const result = eraseNear(
      layer,
      () => false,
      () => "unused",
    );
    expect(result.strokes[0]).toBe(stroke);
  });

  it("drops a whole pen stroke that has fewer than 2 surviving points", () => {
    const stroke = pen("s1", [{ fx: 0.5, fy: 0.5 }]);
    const layer: MapAnnotationLayer = { strokes: [stroke] };
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
      { fx: 0.5, fy: 0 }, // erased, the split point
      { fx: 0.9, fy: 0 },
      { fx: 1, fy: 0 },
    ]);
    const layer: MapAnnotationLayer = { strokes: [stroke] };
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
});
