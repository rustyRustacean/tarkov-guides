"use client";

import { LiveMap, LiveObject } from "@liveblocks/client";
import { useMemo } from "react";

import { diffAnnotationLayer } from "../lib/session-annotations";

import { useMutation, useStorage } from "./liveblocks-config";
import { getParticipantId, useMapSessionStore } from "./session-store";

import type { SessionAnnotationLayerStorage } from "./liveblocks-config";
import type { AnnotationLayerDiff } from "../lib/session-annotations";
import type { MapAnnotationLayer, Stroke } from "../types";
import type { Json } from "@liveblocks/client";

export interface SessionAnnotationLayerHandle {
  layer: MapAnnotationLayer;
  /** The current participant's own id, stamped onto any stroke they add so undo can be author-restricted (see `lib/session-annotations.ts`'s `findOwnStrokeToUndo`). */
  authorId: string;
  onChangeLayer: (next: MapAnnotationLayer) => void;
}

const EMPTY_LAYER: MapAnnotationLayer = { strokes: [] };

function isEmptyDiff(diff: AnnotationLayerDiff): boolean {
  return diff.addedStrokes.length === 0 && diff.removedStrokeIds.length === 0;
}

/**
 * Session-backed replacement for `useMapsStore`'s local per-profile
 * annotation layer. Returns `null` when no session is active, in which case
 * `AnnotationCanvas` falls back to its pre-existing local-store path
 * untouched (see that component's doc comment on the swap). When active,
 * every `onChangeLayer(next)` call is diffed against the current snapshot
 * (`diffAnnotationLayer`) and applied as targeted per-stroke/per-lock
 * `LiveMap` set/delete operations, never a wholesale replace, so concurrent
 * strokes from different participants can't clobber each other. New strokes
 * are stamped with the current participant's id and a timestamp here (not by
 * the caller), matching the multi-contributor drawing this feature
 * reintroduces (see `types.ts`'s `Stroke.authorId` doc comment).
 */
export function useSessionAnnotationLayer(
  mapNormalizedName: string,
  variantId: string,
): SessionAnnotationLayerHandle | null {
  const activeSession = useMapSessionStore((state) => state.activeSession);
  const key = `${mapNormalizedName}:${variantId}`;

  // `root`'s properties come through widened to a broad `Json` union (see
  // `SessionStorage`'s doc comment in `liveblocks-config.ts` on why its index
  // signature forces this). A computed lookup like `root.annotations[key]`
  // can't be typed through that widening at all, so the cast has to happen on
  // `root.annotations` itself before indexing into it, not on the selector's
  // overall return value.
  const layerJson = useStorage((root) => {
    const annotations = root.annotations as unknown as Record<
      string,
      { strokes: Record<string, Stroke> }
    >;
    return annotations[key];
  });
  const layer = useMemo<MapAnnotationLayer>(() => {
    if (!layerJson) return EMPTY_LAYER;
    return { strokes: Object.values(layerJson.strokes) };
  }, [layerJson]);

  const applyChange = useMutation(
    ({ storage }, mutationKey: string, diff: AnnotationLayerDiff, authorId: string) => {
      let entry = storage.get("annotations").get(mutationKey);
      if (!entry) {
        entry = new LiveObject<SessionAnnotationLayerStorage>({
          strokes: new LiveMap<string, Json>(),
        });
        storage.get("annotations").set(mutationKey, entry);
      }
      const strokes = entry.get("strokes");
      for (const stroke of diff.addedStrokes) {
        strokes.set(stroke.id, {
          ...stroke,
          authorId,
          createdAt: Date.now(),
        } as unknown as Json);
      }
      for (const id of diff.removedStrokeIds) strokes.delete(id);
    },
    [],
  );

  if (!activeSession) return null;

  const authorId = getParticipantId();

  function onChangeLayer(next: MapAnnotationLayer): void {
    const diff = diffAnnotationLayer(layer, next);
    if (isEmptyDiff(diff)) return;
    applyChange(key, diff, authorId);
  }

  return { layer, authorId, onChangeLayer };
}
