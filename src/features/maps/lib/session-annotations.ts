import { isStrokeLocked } from "./annotations";

import type { LockRect, MapAnnotationLayer, Stroke } from "../types";

/**
 * Finds the stroke a live session's Ctrl+Z should remove: the most recent
 * unlocked stroke authored by `authorId`. This is the reintroduction of the
 * legacy multi-contributor undo behavior `annotations.ts`'s `undoStroke` doc
 * comment references ("legacy also restricts undo to strokes authored by the
 * current user... not applicable here"; now it is). A pure query rather than
 * a full layer transform (unlike `undoStroke`) because a session's strokes
 * live in a Liveblocks `LiveMap` keyed by id (see `session/liveblocks-config.ts`),
 * not an ordered array: the caller deletes the returned stroke's `id` directly
 * from that map inside a `useMutation`, rather than this function returning a
 * whole new layer to assign back.
 */
export function findOwnStrokeToUndo(
  strokes: readonly Stroke[],
  locks: readonly LockRect[],
  authorId: string,
): Stroke | null {
  let best: Stroke | null = null;
  for (const stroke of strokes) {
    if (stroke.authorId !== authorId) continue;
    if (isStrokeLocked(stroke, locks)) continue;
    if (best === null || (stroke.createdAt ?? 0) > (best.createdAt ?? 0)) {
      best = stroke;
    }
  }
  return best;
}

export interface AnnotationLayerDiff {
  addedStrokes: readonly Stroke[];
  removedStrokeIds: readonly string[];
  addedLocks: readonly LockRect[];
  removedLockIds: readonly string[];
}

/**
 * The by-id difference between two `MapAnnotationLayer` snapshots: added vs.
 * removed strokes/locks, keyed on each item's own stable `id`. Used to
 * translate `AnnotationCanvas`'s "here's the whole new layer" callback into
 * targeted per-item Liveblocks `LiveMap` set/delete calls
 * (`session/use-session-annotation-layer.ts`) instead of replacing the whole
 * shared layer wholesale, which would let two participants drawing at the
 * same time silently clobber each other's concurrent stroke. Never produces a
 * "same id, changed content" case: every mutation this feature performs
 * either adds a whole new stroke/lock or removes one outright (see
 * `annotations.ts`'s `eraseNear`, which always mints fresh ids for any
 * surviving trimmed segments rather than mutating a stroke in place).
 */
export function diffAnnotationLayer(
  prev: MapAnnotationLayer,
  next: MapAnnotationLayer,
): AnnotationLayerDiff {
  const prevStrokeIds = new Set(prev.strokes.map((stroke) => stroke.id));
  const nextStrokeIds = new Set(next.strokes.map((stroke) => stroke.id));
  const prevLockIds = new Set(prev.locks.map((lock) => lock.id));
  const nextLockIds = new Set(next.locks.map((lock) => lock.id));

  return {
    addedStrokes: next.strokes.filter((stroke) => !prevStrokeIds.has(stroke.id)),
    removedStrokeIds: prev.strokes
      .filter((stroke) => !nextStrokeIds.has(stroke.id))
      .map((stroke) => stroke.id),
    addedLocks: next.locks.filter((lock) => !prevLockIds.has(lock.id)),
    removedLockIds: prev.locks.filter((lock) => !nextLockIds.has(lock.id)).map((lock) => lock.id),
  };
}
