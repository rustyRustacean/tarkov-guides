"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Polyline, Rectangle, useMap, useMapEvents } from "react-leaflet";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useDrawTool, type UseDrawToolResult } from "../hooks/use-draw-tool";
import {
  addLock,
  addStroke,
  clearLayer,
  eraserSizeFor,
  eraseNear,
  MAX_STROKE_POINTS,
  removeLock,
  undoStroke,
} from "../lib/annotations";
import { fractionalToLatLng, latLngToFractional } from "../lib/leaflet-crs";
import { findOwnStrokeToUndo } from "../lib/session-annotations";
import { useSessionAnnotationLayer } from "../session/use-session-annotation-layer";
import { ANONYMOUS_PROFILE_ID, useMapsStore } from "../store";

import { AnnotationToolbar } from "./AnnotationToolbar";

import type { FractionalPoint, MapAnnotationLayer, Stroke } from "../types";
import type L from "leaflet";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";

interface Props {
  normalizedMapName: string;
  variantId: string;
  bounds: LatLngBoundsExpression;
}

const EMPTY_LAYER: MapAnnotationLayer = { strokes: [], locks: [] };

function toLatLngTuple(point: FractionalPoint, bounds: LatLngBoundsExpression): LatLngTuple {
  const latLng = fractionalToLatLng(point, bounds);
  return [latLng.lat, latLng.lng];
}

/**
 * A `pen` stroke's real-world Euclidean distance between two fractional
 * points, used as a Leaflet `Circle`'s `radius`. Deliberately NOT
 * `LatLng.distanceTo()`: that method always uses `CRS.Earth`'s haversine
 * formula regardless of the map's actual CRS, which is meaningless here.
 * This feature's custom `CRS.Simple`-based CRS (`leaflet-crs.ts`) treats
 * `lat`/`lng` as literal planar Unity world-space coordinates (a rigid
 * rotation plus a uniform scale, both distance-preserving up to that one
 * scalar), so a plain Euclidean distance on the raw values is the correct
 * (and only sensible) radius calculation.
 */
function planarDistance(a: L.LatLng, b: L.LatLng): number {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng);
}

interface LockDrag {
  start: FractionalPoint;
  current: FractionalPoint;
}

/** The render-dependent values the stable pointer handlers below need, kept fresh via an effect (see `latestRef`'s doc comment). */
interface Latest {
  layer: MapAnnotationLayer;
  draw: UseDrawToolResult;
  bounds: LatLngBoundsExpression;
  onChangeLayer: (next: MapAnnotationLayer) => void;
}

/**
 * The drawing/annotation layer for one map+variant: renders existing
 * strokes/locks as real Leaflet vector geometry, owns pointer handling for
 * drawing new ones, and renders `AnnotationToolbar` as a plain HTML overlay
 * (Leaflet is fine with non-layer children inside `MapContainer`). A
 * self-contained feature panel like `TaskMarkersLayer`, it reads the active
 * profile's annotation state and writes back to `useMapsStore` itself, so
 * `MapViewer` only needs to mount it with a map+variant+bounds.
 */
export function AnnotationCanvas({ normalizedMapName, variantId, bounds }: Props) {
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const mapProfileState = useMapsStore(
    (state) => state.profileState[activeProfileId ?? ANONYMOUS_PROFILE_ID],
  );
  const setAnnotationLayer = useMapsStore((state) => state.setAnnotationLayer);

  // A live collaborative session's shared drawing layer entirely replaces
  // the local per-profile one while active, never merged together (guests
  // have no relationship to the host's Progress Tracker profile, and session
  // strokes are inherently multi-author). `null` when no session is active,
  // in which case this falls back to exactly the pre-existing local-store
  // path below.
  const session = useSessionAnnotationLayer(normalizedMapName, variantId);

  const layer =
    session?.layer ?? mapProfileState?.annotations[normalizedMapName]?.[variantId] ?? EMPTY_LAYER;

  function onChangeLayer(next: MapAnnotationLayer): void {
    if (session) {
      session.onChangeLayer(next);
    } else {
      setAnnotationLayer(normalizedMapName, variantId, next);
    }
  }

  function performUndo(): void {
    if (session) {
      // Author-restricted undo during a session: reintroduces the
      // multi-contributor behavior `lib/annotations.ts`'s `undoStroke` doc
      // comment references as having been dropped in this port.
      const toUndo = findOwnStrokeToUndo(layer.strokes, layer.locks, session.authorId);
      if (toUndo)
        onChangeLayer({ ...layer, strokes: layer.strokes.filter((s) => s.id !== toUndo.id) });
    } else {
      onChangeLayer(undoStroke(layer));
    }
  }

  const draw = useDrawTool({ onUndo: performUndo });
  const map = useMap();

  /**
   * In-progress pointer interaction has two parallel copies on purpose: a
   * ref (canonical, mutated synchronously, read at mouseup to commit the
   * final stroke/lock) and `useState` (a preview mirror, purely to trigger
   * a re-render so the live in-progress line/rectangle is visible). A real
   * browser test proved this needs both: a fast real drag can fire several
   * native `mousemove` events before React re-renders, so multiple events in
   * a row can read the exact same (stale) `useState` closure and silently
   * overwrite each other's point instead of accumulating. The ref sidesteps
   * that entirely: it's the same mutable object regardless of timing, so
   * every event's read always sees the previous event's result. The state
   * mirror can still skip/coalesce intermediate frames under React's
   * batching without losing data, since the ref (not the state) is what's
   * actually committed on mouseup/erase.
   */
  const activeStrokeRef = useRef<Stroke | null>(null);
  const lockDragRef = useRef<LockDrag | null>(null);
  const isErasingRef = useRef(false);

  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [lockDrag, setLockDrag] = useState<LockDrag | null>(null);
  const [pendingClearStash, setPendingClearStash] = useState<readonly Stroke[] | null>(null);

  /**
   * A second real-browser test found a further, more severe issue with
   * plain `useMapEvents({...})`: it hands Leaflet a brand-new handlers
   * object every render (`useMapEvents`'s own effect deps are `[map,
   * handlers]`), so it tears down and re-subscribes its native
   * mousedown/mousemove/mouseup listeners on every single render: every
   * point added to an in-progress stroke triggers exactly this cycle.
   * Confirmed via a real drag immediately following an earlier committed
   * stroke (so several such cycles had already happened): mousedown and
   * every mousemove fired correctly, but the drag's own final mouseup was
   * silently lost, not delivered to any handler at all until a much later,
   * unrelated interaction's mouseup finally arrived. The fix is to never
   * give `useMapEvents` a reason to resubscribe: `handlers` below is
   * created exactly once via `useState`'s lazy initializer (a value
   * genuinely computed a single time, unlike a raw ref write; see the
   * `react-hooks/refs` constraint noted throughout this file) and its
   * functions read all render-dependent data through `latestRef` instead of
   * closing over `layer`/`draw`/`bounds`/`onChangeLayer` directly, so their
   * own identities never need to change.
   */
  const latestRef = useRef<Latest>({ layer, draw, bounds, onChangeLayer });
  useEffect(() => {
    latestRef.current = { layer, draw, bounds, onChangeLayer };
  });

  const [handlers] = useState(() => ({
    mousedown(event: L.LeafletMouseEvent) {
      const { draw, bounds, layer, onChangeLayer } = latestRef.current;
      if (!draw.drawModeOn || event.originalEvent.button !== 0) return;
      const point = latLngToFractional(event.latlng, bounds);

      if (draw.effectiveTool === "lock") {
        const next: LockDrag = { start: point, current: point };
        lockDragRef.current = next;
        setLockDrag(next);
        return;
      }
      if (draw.effectiveTool === "erase") {
        isErasingRef.current = true;
        const radiusPx = eraserSizeFor(draw.width) / 2;
        const cursor = map.latLngToContainerPoint(event.latlng);
        onChangeLayer(
          eraseNear(
            layer,
            (candidate) =>
              map
                .latLngToContainerPoint(fractionalToLatLng(candidate, bounds))
                .distanceTo(cursor) <= radiusPx,
            () => crypto.randomUUID(),
          ),
        );
        return;
      }
      const next: Stroke =
        draw.effectiveTool === "circle"
          ? {
              id: crypto.randomUUID(),
              type: "circle",
              color: draw.color,
              width: draw.width,
              center: point,
              edge: point,
            }
          : {
              id: crypto.randomUUID(),
              type: "pen",
              color: draw.color,
              width: draw.width,
              points: [point],
            };
      activeStrokeRef.current = next;
      setActiveStroke(next);
    },

    mousemove(event: L.LeafletMouseEvent) {
      const { draw, bounds, layer, onChangeLayer } = latestRef.current;
      if (!draw.drawModeOn) return;
      const point = latLngToFractional(event.latlng, bounds);

      const currentLockDrag = lockDragRef.current;
      if (currentLockDrag) {
        const next: LockDrag = { start: currentLockDrag.start, current: point };
        lockDragRef.current = next;
        setLockDrag(next);
        return;
      }
      if (isErasingRef.current) {
        const radiusPx = eraserSizeFor(draw.width) / 2;
        const cursor = map.latLngToContainerPoint(event.latlng);
        onChangeLayer(
          eraseNear(
            layer,
            (candidate) =>
              map
                .latLngToContainerPoint(fractionalToLatLng(candidate, bounds))
                .distanceTo(cursor) <= radiusPx,
            () => crypto.randomUUID(),
          ),
        );
        return;
      }
      const currentActiveStroke = activeStrokeRef.current;
      if (!currentActiveStroke) return;
      const next: Stroke =
        currentActiveStroke.type === "circle"
          ? { ...currentActiveStroke, edge: point }
          : currentActiveStroke.points.length >= MAX_STROKE_POINTS
            ? currentActiveStroke
            : { ...currentActiveStroke, points: [...currentActiveStroke.points, point] };
      activeStrokeRef.current = next;
      setActiveStroke(next);
    },

    mouseup() {
      const { draw, layer, onChangeLayer } = latestRef.current;
      if (!draw.drawModeOn) return;

      const currentLockDrag = lockDragRef.current;
      if (currentLockDrag) {
        onChangeLayer(
          addLock(layer, {
            id: crypto.randomUUID(),
            corner1: currentLockDrag.start,
            corner2: currentLockDrag.current,
          }),
        );
        lockDragRef.current = null;
        setLockDrag(null);
        return;
      }
      if (isErasingRef.current) {
        isErasingRef.current = false;
        return;
      }
      const currentActiveStroke = activeStrokeRef.current;
      if (!currentActiveStroke) return;
      activeStrokeRef.current = null;
      setActiveStroke(null);
      if (currentActiveStroke.type === "pen" && currentActiveStroke.points.length < 2) return;
      onChangeLayer(addStroke(layer, currentActiveStroke));
    },
  }));

  useMapEvents(handlers);

  useEffect(() => {
    if (draw.drawModeOn) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    }
    return () => {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    };
  }, [draw.drawModeOn, map]);

  function handleClear(): void {
    const result = clearLayer(layer, pendingClearStash);
    onChangeLayer(result.layer);
    setPendingClearStash(result.stash);
  }

  const visibleStrokes = activeStroke ? [...layer.strokes, activeStroke] : layer.strokes;

  return (
    <>
      <AnnotationToolbar
        drawModeOn={draw.drawModeOn}
        onToggleDrawMode={draw.toggleDrawMode}
        // A collaborative session's shared layer doesn't need a local
        // profile (see `session`'s doc comment above); only gate on having
        // nowhere to save when there's neither a profile nor a session.
        disabled={activeProfileId === null && !session}
        baseTool={draw.baseTool}
        onSelectTool={draw.setBaseTool}
        color={draw.color}
        onSelectColor={draw.setColor}
        width={draw.width}
        onChangeWidth={draw.setWidth}
        onUndo={performUndo}
        onClear={handleClear}
        clearPending={pendingClearStash !== null}
      />

      {/*
        `interactive={false}` on every stroke: confirmed via a real
        browser test to be load-bearing, not cosmetic. Leaflet vector
        layers are interactive (hit-testable) by default, and a growing
        in-progress stroke/lock preview sits directly under the cursor at
        the exact moment the drag ends. An interactive layer's own
        mouseup handling stops the event from ever reaching the map
        container-level "mouseup" this component's `useMapEvents` relies
        on to commit the drag, silently freezing it mid-drag (confirmed:
        the committed lock/stroke stayed pinned to its start point,
        mouseup never fired at all). Committed lock rectangles are the one
        deliberate exception: they stay interactive so clicking one while
        the Lock tool is active can remove it (`removeLock` below).
        Deliberately a top-level prop, NOT inside `pathOptions`: react-leaflet
        only reads `interactive` at Leaflet layer construction time (from the
        component's own props), while `pathOptions` is reconciled later via a
        separate `setStyle()` effect that isn't guaranteed to retroactively
        tear down interaction listeners already wired up at creation.
      */}
      {visibleStrokes.map((stroke) =>
        stroke.type === "circle" ? (
          <Circle
            key={stroke.id}
            center={fractionalToLatLng(stroke.center, bounds)}
            radius={planarDistance(
              fractionalToLatLng(stroke.center, bounds),
              fractionalToLatLng(stroke.edge, bounds),
            )}
            pathOptions={{ color: stroke.color, weight: stroke.width }}
            interactive={false}
          />
        ) : (
          <Polyline
            key={stroke.id}
            positions={stroke.points.map((point) => toLatLngTuple(point, bounds))}
            pathOptions={{ color: stroke.color, weight: stroke.width }}
            interactive={false}
          />
        ),
      )}

      {draw.drawModeOn &&
        layer.locks.map((lock) => (
          <Rectangle
            key={lock.id}
            bounds={[toLatLngTuple(lock.corner1, bounds), toLatLngTuple(lock.corner2, bounds)]}
            pathOptions={{ color: "#9ca3af", dashArray: "4 4", fillOpacity: 0.05 }}
            eventHandlers={{
              click: () => {
                if (draw.effectiveTool === "lock") onChangeLayer(removeLock(layer, lock.id));
              },
            }}
          />
        ))}

      {draw.drawModeOn && lockDrag && (
        <Rectangle
          bounds={[toLatLngTuple(lockDrag.start, bounds), toLatLngTuple(lockDrag.current, bounds)]}
          pathOptions={{ color: "#9ca3af", dashArray: "4 4" }}
          interactive={false}
        />
      )}
    </>
  );
}
