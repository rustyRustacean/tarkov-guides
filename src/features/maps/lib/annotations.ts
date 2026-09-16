import type { FractionalPoint, MapAnnotationLayer, Stroke } from "../types";

/** Ported verbatim from `annotations.js`'s slider bounds/default. */
export const STROKE_WIDTH_MIN = 1;
export const STROKE_WIDTH_MAX = 48;
export const STROKE_WIDTH_DEFAULT = 4;

/** Ported verbatim from `annotations.js`'s `ERASER_SIZE_MULT` (slider 4 -> eraser 10px, slider 48 -> eraser 120px). */
export const ERASER_SIZE_MULTIPLIER = 2.5;

/**
 * A freehand `pen` stroke stops accepting new points once it hits this
 * length (enforced in `AnnotationCanvas`'s `mousemove` handler, the one
 * place points are appended). Bounds the worst-case size of a single
 * stroke, which in a live collaborative session is a payload synced to
 * every other participant via Liveblocks Storage (see
 * `session/use-session-annotation-layer.ts`), without constraining any
 * realistic hand-drawn gesture on a map view.
 */
export const MAX_STROKE_POINTS = 2000;

/** Ported verbatim from `annotations.js`'s `DRAW_COLOR_PRESETS`; red is also the default color. */
export const DRAW_COLOR_PRESETS: readonly string[] = ["#ff3b3b", "#3b86ff", "#ffd83b", "#3bd85a"];
export const DEFAULT_STROKE_COLOR = "#ff3b3b";

/** The eraser's brush diameter for a given base stroke width; see `ERASER_SIZE_MULTIPLIER`'s doc comment. */
export function eraserSizeFor(width: number): number {
  return Math.round(width * ERASER_SIZE_MULTIPLIER);
}

/** A `rect` stroke's fractional-space center: the midpoint of its two corners, unaffected by `rotation` (rotating around the center never moves it). */
export function rectCenter(stroke: {
  corner1: FractionalPoint;
  corner2: FractionalPoint;
}): FractionalPoint {
  return {
    fx: (stroke.corner1.fx + stroke.corner2.fx) / 2,
    fy: (stroke.corner1.fy + stroke.corner2.fy) / 2,
  };
}

/** Appends a freshly-drawn stroke. */
export function addStroke(layer: MapAnnotationLayer, stroke: Stroke): MapAnnotationLayer {
  return { ...layer, strokes: [...layer.strokes, stroke] };
}

/**
 * Replaces one stroke's geometry by id with `next` (which must carry its own
 * **new** id, not the id it's replacing) rather than mutating in place.
 * Required by `session/use-session-annotation-layer.ts`'s
 * `diffAnnotationLayer`, which (like `eraseNear`'s own trimmed segments)
 * only ever detects a whole stroke added or removed by id, never a same-id
 * content change, so a live collaborative session would silently fail to
 * sync an in-place edit. The id is the caller's choice, not generated here,
 * so a Select-tool move/rotate commit can immediately re-select the result
 * by that same id (see `AnnotationCanvas.tsx`'s `setSelectedStrokeId`
 * calls); the in-progress drag itself stays purely local state and never
 * calls this per frame, only once on mouseup.
 */
export function replaceStroke(
  layer: MapAnnotationLayer,
  strokeId: string,
  next: Stroke,
): MapAnnotationLayer {
  return {
    ...layer,
    strokes: layer.strokes.map((stroke) => (stroke.id === strokeId ? next : stroke)),
  };
}

/**
 * Translates every stroke type's geometry by a fractional-space delta:
 * Select tool's move-drag. Fractional space is a safe space to translate in
 * (a uniform-scale, axis-aligned remap of each variant's own image bounds),
 * unlike rotation, which needs real projected LatLng space instead (see
 * `AnnotationCanvas.tsx`'s `rectCorners` doc comment).
 */
export function translateStroke(stroke: Stroke, delta: FractionalPoint): Stroke {
  const shift = (point: FractionalPoint): FractionalPoint => ({
    fx: point.fx + delta.fx,
    fy: point.fy + delta.fy,
  });
  if (stroke.type === "pen") return { ...stroke, points: stroke.points.map(shift) };
  if (stroke.type === "circle")
    return { ...stroke, center: shift(stroke.center), edge: shift(stroke.edge) };
  return { ...stroke, corner1: shift(stroke.corner1), corner2: shift(stroke.corner2) };
}

/** Removes the most recently drawn stroke (walking from the tail, per `undoDraw` in `fullscreen.js`). */
export function undoStroke(layer: MapAnnotationLayer): MapAnnotationLayer {
  if (layer.strokes.length === 0) return layer;
  return { ...layer, strokes: layer.strokes.slice(0, -1) };
}

export interface ClearResult {
  layer: MapAnnotationLayer;
  /** `null` means no clear is pending (either never cleared, or a stash was just restored). Non-null (possibly empty) means a clear just stashed these strokes, waiting for either a second `clearLayer` call (restore) or any draw/map-switch (discard); see the toggle-morph doc below. */
  stash: readonly Stroke[] | null;
}

/**
 * Toggle-morph clear, ported faithfully from `fullscreen.js`'s
 * `clearDrawings`/`undoClearDrawings`: the first call empties the layer and
 * returns its strokes as a stash; a second call (passing that same stash
 * back in as `pendingStash`) restores them and clears the stash. Callers are
 * responsible for discarding a stale stash themselves (any new stroke, or
 * switching map/variant) by simply not passing it back in.
 */
export function clearLayer(
  layer: MapAnnotationLayer,
  pendingStash: readonly Stroke[] | null,
): ClearResult {
  if (pendingStash !== null) {
    return { layer: { ...layer, strokes: [...layer.strokes, ...pendingStash] }, stash: null };
  }
  return { layer: { ...layer, strokes: [] }, stash: layer.strokes };
}

/**
 * The eraser tool's real effect. **Not** a port of either legacy variant's
 * literal erase behavior (see `Stroke`'s doc comment in `types.ts` for why:
 * the raster-canvas variant's real `destination-out` compositing doesn't
 * fit this port's vector-geometry rendering, and the Leaflet variant's own
 * "erase" is non-functional). Instead this destructively trims `pen`
 * strokes (dropping erased points, splitting into separate strokes around
 * any erased interior points, dropping a run entirely once it has fewer
 * than 2 points left) and drops `circle`/`rect` strokes whose center is
 * erased. `isNear` is a caller-supplied geometric predicate (built from the
 * live map's current projection/zoom, since "erase near the cursor" is a
 * screen-pixel-radius concept, not a fractional-coordinate one); this
 * function only handles the array bookkeeping.
 */
export function eraseNear(
  layer: MapAnnotationLayer,
  isNear: (point: FractionalPoint) => boolean,
  makeId: () => string,
): MapAnnotationLayer {
  const nextStrokes: Stroke[] = [];

  for (const stroke of layer.strokes) {
    if (stroke.type === "circle") {
      if (!isNear(stroke.center)) nextStrokes.push(stroke);
      continue;
    }
    if (stroke.type === "rect") {
      if (!isNear(rectCenter(stroke))) nextStrokes.push(stroke);
      continue;
    }

    const anyErased = stroke.points.some((point) => isNear(point));
    if (!anyErased) {
      nextStrokes.push(stroke);
      continue;
    }

    let run: FractionalPoint[] = [];
    const flushRun = () => {
      if (run.length >= 2) nextStrokes.push({ ...stroke, id: makeId(), points: run });
      run = [];
    };
    for (const point of stroke.points) {
      if (isNear(point)) flushRun();
      else run.push(point);
    }
    flushRun();
  }

  return { ...layer, strokes: nextStrokes };
}
