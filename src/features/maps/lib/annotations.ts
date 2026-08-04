import type { FractionalPoint, LockRect, MapAnnotationLayer, Stroke } from "../types";

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
 * stroke - which, in a live collaborative session, is a payload synced to
 * every other participant via Liveblocks Storage (see
 * `session/use-session-annotation-layer.ts`) - without constraining any
 * realistic hand-drawn gesture on a map view.
 */
export const MAX_STROKE_POINTS = 2000;

/** Ported verbatim from `annotations.js`'s `DRAW_COLOR_PRESETS` - red is also the default color. */
export const DRAW_COLOR_PRESETS: readonly string[] = ["#ff3b3b", "#3b86ff", "#ffd83b", "#3bd85a"];
export const DEFAULT_STROKE_COLOR = "#ff3b3b";

/** The eraser's brush diameter for a given base stroke width - see `ERASER_SIZE_MULTIPLIER`'s doc comment. */
export function eraserSizeFor(width: number): number {
  return Math.round(width * ERASER_SIZE_MULTIPLIER);
}

/** Axis-aligned bounding-box containment - `corner1`/`corner2` are opposite corners of a drag, not already min/max. */
function pointInLock(point: FractionalPoint, lock: LockRect): boolean {
  const minX = Math.min(lock.corner1.fx, lock.corner2.fx);
  const maxX = Math.max(lock.corner1.fx, lock.corner2.fx);
  const minY = Math.min(lock.corner1.fy, lock.corner2.fy);
  const maxY = Math.max(lock.corner1.fy, lock.corner2.fy);
  return point.fx >= minX && point.fx <= maxX && point.fy >= minY && point.fy <= maxY;
}

/**
 * Whether `stroke` is protected from {@link undoStroke}/{@link clearLayer} by
 * any lock rect - ported exactly from `annotations.js`'s `isStrokeLocked`:
 * a `pen` stroke is locked if **any** of its points falls inside **any**
 * lock; a `circle` is locked only if its **center** does (the edge/radius is
 * deliberately ignored, matching confirmed legacy behavior). Locking never
 * affects drawing/erasing itself - only undo/clear ever call this, exactly
 * as legacy does (confirmed via source: `isStrokeLocked` has exactly 2 call
 * sites, both in undo/clear).
 */
export function isStrokeLocked(stroke: Stroke, locks: readonly LockRect[]): boolean {
  if (locks.length === 0) return false;
  if (stroke.type === "circle") return locks.some((lock) => pointInLock(stroke.center, lock));
  return stroke.points.some((point) => locks.some((lock) => pointInLock(point, lock)));
}

/** Appends a freshly-drawn stroke. */
export function addStroke(layer: MapAnnotationLayer, stroke: Stroke): MapAnnotationLayer {
  return { ...layer, strokes: [...layer.strokes, stroke] };
}

/**
 * Removes the most recent **unlocked** stroke (walking from the tail, per
 * `undoDraw` in `fullscreen.js`). Legacy also restricts undo to strokes
 * authored by the current user, since a live-share session can have several
 * contributors - not applicable here (this port has no live-share/
 * multi-user compositing), so every stroke in a profile's layer is
 * implicitly that profile's own, and this collapses to "most recent
 * unlocked stroke."
 */
export function undoStroke(layer: MapAnnotationLayer): MapAnnotationLayer {
  for (let i = layer.strokes.length - 1; i >= 0; i--) {
    const stroke = layer.strokes[i];
    if (stroke !== undefined && !isStrokeLocked(stroke, layer.locks)) {
      return {
        ...layer,
        strokes: [...layer.strokes.slice(0, i), ...layer.strokes.slice(i + 1)],
      };
    }
  }
  return layer;
}

export interface ClearResult {
  layer: MapAnnotationLayer;
  /** `null` means no clear is pending (either never cleared, or a stash was just restored). Non-null (possibly empty) means a clear just stashed these strokes, waiting for either a second `clearLayer` call (restore) or any draw/map-switch (discard) - see the toggle-morph doc below. */
  stash: readonly Stroke[] | null;
}

/**
 * Toggle-morph clear, ported faithfully from `fullscreen.js`'s
 * `clearDrawings`/`undoClearDrawings`: the first call removes every
 * unlocked stroke (locked ones stay) and returns them as a stash; a second
 * call (passing that same stash back in as `pendingStash`) restores them
 * and clears the stash. Callers are responsible for discarding a stale
 * stash themselves (any new stroke, or switching map/variant) by simply not
 * passing it back in - this function has no notion of "this stash belongs
 * to a different map" since it operates on a single already-resolved layer.
 */
export function clearLayer(
  layer: MapAnnotationLayer,
  pendingStash: readonly Stroke[] | null,
): ClearResult {
  if (pendingStash !== null) {
    return { layer: { ...layer, strokes: [...layer.strokes, ...pendingStash] }, stash: null };
  }
  const locked = layer.strokes.filter((stroke) => isStrokeLocked(stroke, layer.locks));
  const unlocked = layer.strokes.filter((stroke) => !isStrokeLocked(stroke, layer.locks));
  return { layer: { ...layer, strokes: locked }, stash: unlocked };
}

/** Adds a protected rectangle - strokes fully described by {@link isStrokeLocked} inside it become immune to undo/clear. */
export function addLock(layer: MapAnnotationLayer, lock: LockRect): MapAnnotationLayer {
  return { ...layer, locks: [...layer.locks, lock] };
}

/** Removes a lock rect by id (e.g. clicking an existing lock while the Lock tool is active, matching `leaflet.js`'s click-to-unlock behavior). */
export function removeLock(layer: MapAnnotationLayer, lockId: string): MapAnnotationLayer {
  return { ...layer, locks: layer.locks.filter((lock) => lock.id !== lockId) };
}

/**
 * The eraser tool's real effect - **not** a port of either legacy variant's
 * literal erase behavior (see `Stroke`'s doc comment in `types.ts` for why:
 * the raster-canvas variant's real `destination-out` compositing doesn't
 * fit this port's vector-geometry rendering, and the Leaflet variant's own
 * "erase" is confirmed non-functional). Instead this destructively trims
 * `pen` strokes (dropping erased points, splitting into separate strokes
 * around any erased interior points, dropping a run entirely once it has
 * fewer than 2 points left) and drops `circle` strokes whose center is
 * erased. `isNear` is a caller-supplied geometric predicate (built from the
 * live map's current projection/zoom, since "erase near the cursor" is a
 * screen-pixel-radius concept, not a fractional-coordinate one) - this
 * function only handles the array bookkeeping. Locked strokes are NOT
 * protected from erasing (matches confirmed legacy behavior - locks only
 * ever protect against undo/clear).
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
