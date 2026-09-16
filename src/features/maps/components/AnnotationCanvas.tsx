"use client";

import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  Polygon,
  Polyline,
  Rectangle,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useDrawTool, type UseDrawToolResult } from "../hooks/use-draw-tool";
import { useMapMouseGestures } from "../hooks/use-map-mouse-gestures";
import {
  addStroke,
  clearLayer,
  eraserSizeFor,
  eraseNear,
  MAX_STROKE_POINTS,
  replaceStroke,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
  translateStroke,
  undoStroke,
} from "../lib/annotations";
import { fractionalToLatLng, latLngToFractional } from "../lib/leaflet-crs";
import { findOwnStrokeToUndo } from "../lib/session-annotations";
import { useSessionAnnotationLayer } from "../session/use-session-annotation-layer";
import { ANONYMOUS_PROFILE_ID, useMapsStore } from "../store";

import { AnnotationToolbar } from "./AnnotationToolbar";

import type { FractionalPoint, MapAnnotationLayer, Stroke } from "../types";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";

interface Props {
  normalizedMapName: string;
  variantId: string;
  bounds: LatLngBoundsExpression;
}

/** The 2 stroke types created via a plain drag-to-size gesture (`activeStrokeRef`); `rect` uses its own `RectDrag` instead (see that interface's doc comment), and never becomes an `activeStroke`. */
type DrawingStroke = Extract<Stroke, { type: "pen" | "circle" }>;
type RectStroke = Extract<Stroke, { type: "rect" }>;

const EMPTY_LAYER: MapAnnotationLayer = { strokes: [] };

/** Cursor-to-shape grab tolerance for the Select tool's hit test, and the erase/select minimum, in screen pixels. */
const HIT_TOLERANCE_PX = 8;

/** How far beyond a selected rectangle's rotated top edge its rotate handle floats, in screen pixels (a fixed on-screen distance regardless of zoom, since it's computed in projected container-point space, not fractional/lat-lng space). */
const ROTATE_HANDLE_OFFSET_PX = 22;

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
 * (and only sensible) radius calculation. `rectCorners`/`rotateHandlePosition`
 * below lean on this exact same planar property to rotate a rectangle
 * correctly instead of shearing it (see `rectCorners`'s own doc comment).
 */
function planarDistance(a: L.LatLng, b: L.LatLng): number {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng);
}

/**
 * A `rect` stroke's 4 corners as real `LatLng`s, `stroke.rotation` degrees
 * applied around its own center. Deliberately rotates in projected `LatLng`
 * space, not raw fractional (`0..1`-of-image-bounds) space: fractional space
 * rescales each axis independently to fit the image's own width/height, so
 * for any non-square map image, one fractional unit of `fx` and one of `fy`
 * cover different real distances, and rotating there would visibly shear the
 * rectangle instead of turning it. `LatLng` space is the one this feature
 * already treats as a true undistorted plane (see `planarDistance`'s doc
 * comment), so corners are computed in image-fractional space (matching
 * every other stroke type's storage), converted to `LatLng`, rotated there,
 * and returned already in the space Leaflet's `Polygon` renders directly.
 */
function rectCorners(
  stroke: Pick<RectStroke, "corner1" | "corner2" | "rotation">,
  bounds: LatLngBoundsExpression,
): [L.LatLng, L.LatLng, L.LatLng, L.LatLng] {
  const a = fractionalToLatLng(stroke.corner1, bounds);
  const b = fractionalToLatLng(stroke.corner2, bounds);
  const minLat = Math.min(a.lat, b.lat);
  const maxLat = Math.max(a.lat, b.lat);
  const minLng = Math.min(a.lng, b.lng);
  const maxLng = Math.max(a.lng, b.lng);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  // Top-left, top-right, bottom-right, bottom-left (lat runs south->north, so "top"/north is maxLat).
  const corners: readonly [number, number][] = [
    [maxLat, minLng],
    [maxLat, maxLng],
    [minLat, maxLng],
    [minLat, minLng],
  ];
  if (stroke.rotation === 0) {
    return corners.map(([lat, lng]) => L.latLng(lat, lng)) as [
      L.LatLng,
      L.LatLng,
      L.LatLng,
      L.LatLng,
    ];
  }
  const rad = (stroke.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return corners.map(([lat, lng]) => {
    const dLat = lat - centerLat;
    const dLng = lng - centerLng;
    return L.latLng(centerLat + (dLng * sin + dLat * cos), centerLng + (dLng * cos - dLat * sin));
  }) as [L.LatLng, L.LatLng, L.LatLng, L.LatLng];
}

/** Where a selected rectangle's rotate handle floats: a fixed screen-pixel distance beyond the midpoint of its current (possibly mid-rotation) top edge, so dragging it traces a natural circular arc around the rectangle's center regardless of zoom. */
function rotateHandlePosition(
  stroke: RectStroke,
  bounds: LatLngBoundsExpression,
  map: L.Map,
): L.LatLng {
  const [topLeft, topRight, bottomRight] = rectCorners(stroke, bounds);
  const centerLatLng = L.latLng(
    (topLeft.lat + bottomRight.lat) / 2,
    (topLeft.lng + bottomRight.lng) / 2,
  );
  const topMidLatLng = L.latLng((topLeft.lat + topRight.lat) / 2, (topLeft.lng + topRight.lng) / 2);
  const centerPx = map.latLngToContainerPoint(centerLatLng);
  const topPx = map.latLngToContainerPoint(topMidLatLng);
  const dx = topPx.x - centerPx.x;
  const dy = topPx.y - centerPx.y;
  const length = Math.hypot(dx, dy) || 1;
  return map.containerPointToLatLng(
    L.point(
      topPx.x + (dx / length) * ROTATE_HANDLE_OFFSET_PX,
      topPx.y + (dy / length) * ROTATE_HANDLE_OFFSET_PX,
    ),
  );
}

/** Shortest distance from `point` to the segment `a`-`b`, all in the same (screen container-point) space. */
function distanceToSegment(point: L.Point, a: L.Point, b: L.Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) return point.distanceTo(a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq));
  return point.distanceTo(L.point(a.x + t * abx, a.y + t * aby));
}

/** Standard sign-of-cross-product convex-polygon containment test, all in screen container-point space (`rectCorners`' output is always a convex quadrilateral). */
function pointInPolygon(point: L.Point, corners: readonly L.Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    if (a === undefined || b === undefined) continue;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross === 0) continue;
    const next = cross > 0 ? 1 : -1;
    if (sign === 0) sign = next;
    else if (next !== sign) return false;
  }
  return true;
}

/** The Select tool's hit test: is `cursor` (a screen container point) close enough to `stroke` to grab it? Projects each stroke's own geometry to the same screen space the cursor is already in, matching how `eraseNear`'s own `isNear` predicate is built below. */
function hitTestStroke(
  stroke: Stroke,
  cursor: L.Point,
  map: L.Map,
  bounds: LatLngBoundsExpression,
): boolean {
  const project = (point: FractionalPoint): L.Point =>
    map.latLngToContainerPoint(fractionalToLatLng(point, bounds));

  if (stroke.type === "circle") {
    const center = project(stroke.center);
    const radius = center.distanceTo(project(stroke.edge));
    return cursor.distanceTo(center) <= radius + HIT_TOLERANCE_PX;
  }
  if (stroke.type === "rect") {
    const corners = rectCorners(stroke, bounds).map((corner) => map.latLngToContainerPoint(corner));
    return pointInPolygon(cursor, corners);
  }
  const tolerance = Math.max(stroke.width, HIT_TOLERANCE_PX);
  if (stroke.points.length === 1) {
    const only = stroke.points[0];
    return only !== undefined && cursor.distanceTo(project(only)) <= tolerance;
  }
  for (let i = 0; i < stroke.points.length - 1; i++) {
    const a = stroke.points[i];
    const b = stroke.points[i + 1];
    if (a === undefined || b === undefined) continue;
    if (distanceToSegment(cursor, project(a), project(b)) <= tolerance) return true;
  }
  return false;
}

/** The Rectangle tool's in-progress create-by-drag corners, before it becomes a real `rect` `Stroke` on mouseup (always `rotation: 0` at creation; rotating is a separate gesture on an already-drawn rectangle, see `rotateHandlePosition`). */
interface RectDrag {
  start: FractionalPoint;
  current: FractionalPoint;
}

/** The Select tool's in-progress move-drag: `original` is a fixed snapshot taken at mousedown, and `current` is updated every mousemove, so the live preview (`fx: current.fx - origin.fx`) is always recomputed fresh from that snapshot rather than compounded frame over frame. */
interface MoveDrag {
  strokeId: string;
  original: Stroke;
  origin: FractionalPoint;
  current: FractionalPoint;
}

/** A rectangle's rotate-handle drag in progress, live-previewed via `rotatePreview` below; see `AnnotationCanvas`'s `handleRotateHandleMouseDown`. */
interface RotateDrag {
  strokeId: string;
  original: RectStroke;
  centerPx: L.Point;
  baseAngle: number;
  baseRotation: number;
}

interface RotatePreview {
  strokeId: string;
  rotation: number;
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
 * strokes as real Leaflet vector geometry, owns pointer handling for
 * drawing/moving/rotating them, and renders `AnnotationToolbar` as a plain
 * HTML overlay (Leaflet is fine with non-layer children inside
 * `MapContainer`). A self-contained feature panel like `TaskMarkersLayer`,
 * it reads the active profile's annotation state and writes back to
 * `useMapsStore` itself, so `MapViewer` only needs to mount it with a
 * map+variant+bounds.
 */
export function AnnotationCanvas({ normalizedMapName, variantId, bounds }: Props) {
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const mapProfileState = useMapsStore(
    (state) => state.profileState[activeProfileId ?? ANONYMOUS_PROFILE_ID],
  );
  const setAnnotationLayer = useMapsStore((state) => state.setAnnotationLayer);
  const persistDrawingsAcrossReload = useMapsStore((state) => state.persistDrawingsAcrossReload);
  const setPersistDrawingsAcrossReload = useMapsStore(
    (state) => state.setPersistDrawingsAcrossReload,
  );

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
      const toUndo = findOwnStrokeToUndo(layer.strokes, session.authorId);
      if (toUndo)
        onChangeLayer({ ...layer, strokes: layer.strokes.filter((s) => s.id !== toUndo.id) });
    } else {
      onChangeLayer(undoStroke(layer));
    }
  }

  const draw = useDrawTool({ onUndo: performUndo });
  const map = useMap();

  useMapMouseGestures({ map, onToggleDrawMode: draw.toggleDrawMode });

  // The map wears the tool you are holding (see globals.css). Keyed off
  // `effectiveTool`, so holding Ctrl for the momentary eraser swaps the
  // cursor for exactly as long as the key is down.
  useEffect(() => {
    const container = map.getContainer();
    const cursorClass = !draw.drawModeOn
      ? null
      : draw.effectiveTool === "pen"
        ? "map-cursor-pen"
        : draw.effectiveTool === "erase"
          ? "map-cursor-eraser"
          : "map-cursor-crosshair";
    if (cursorClass === null) return;
    container.classList.add(cursorClass);
    return () => {
      container.classList.remove(cursorClass);
    };
  }, [draw.drawModeOn, draw.effectiveTool, map]);

  /**
   * In-progress pointer interaction has two parallel copies on purpose: a
   * ref (canonical, mutated synchronously, read at mouseup to commit the
   * final stroke/move/rect) and `useState` (a preview mirror, purely to
   * trigger a re-render so the live in-progress geometry is visible). A real
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
  const activeStrokeRef = useRef<DrawingStroke | null>(null);
  const rectDragRef = useRef<RectDrag | null>(null);
  const moveDragRef = useRef<MoveDrag | null>(null);
  const isErasingRef = useRef(false);

  const [activeStroke, setActiveStroke] = useState<DrawingStroke | null>(null);
  const [rectDrag, setRectDrag] = useState<RectDrag | null>(null);
  const [moveDrag, setMoveDrag] = useState<MoveDrag | null>(null);
  const [pendingClearStash, setPendingClearStash] = useState<readonly Stroke[] | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);

  /**
   * The toolbar's width slider drops a same-size dot at the center of the
   * map viewport (not the toolbar itself, see `AnnotationToolbar`'s Size
   * section) so the number on the slider has a concrete on-map size to
   * anchor to. `fading` is a separate flag rather than clearing this to
   * `null` immediately: going straight to `null` would unmount the div
   * before its opacity transition could play, so the dot instead fades in
   * place and only unmounts once that CSS transition actually finishes.
   */
  const [sizePreview, setSizePreview] = useState<{
    width: number;
    color: string;
    fading: boolean;
  } | null>(null);
  const sizePreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sizePreviewTimerRef.current) clearTimeout(sizePreviewTimerRef.current);
    };
  }, []);

  function handleChangeWidth(nextWidth: number): void {
    draw.setWidth(nextWidth);
    setSizePreview({ width: nextWidth, color: draw.color, fading: false });
    if (sizePreviewTimerRef.current) clearTimeout(sizePreviewTimerRef.current);
    sizePreviewTimerRef.current = setTimeout(() => {
      setSizePreview((current) => (current ? { ...current, fading: true } : null));
    }, 700);
  }

  // The rotate handle's own drag lifecycle (see `handleRotateHandleMouseDown`)
  // deliberately does NOT go through `useMapEvents`/`handlers` below: the
  // handle is a real interactive Leaflet layer (`CircleMarker`, so it's a
  // precise, easy-to-grab target), and this file already learned the hard
  // way (see the big comment on `interactive={false}` further down) that an
  // interactive layer's own mouseup never reaches the map container-level
  // mouseup `useMapEvents` relies on. Native `window` listeners, attached
  // only for the duration of this one drag, sidestep that entirely.
  const rotateDragRef = useRef<RotateDrag | null>(null);
  const rotatePreviewRef = useRef<RotatePreview | null>(null);
  const [rotatePreview, setRotatePreview] = useState<RotatePreview | null>(null);

  // Deselect on leaving the Select tool, so switching to Pen/Circle/etc and
  // back doesn't leave a stale rotate handle floating over whatever used to
  // be selected. Adjusted during render (React's documented pattern for
  // "reset state when a prop changes"), not inside a `useEffect`: an effect
  // would commit the old selection for one extra frame before the reset
  // took hold, and calling `setState` synchronously inside an effect body
  // just to undo a render that already happened is the exact anti-pattern
  // `react-hooks/set-state-in-effect` flags.
  const [lastBaseTool, setLastBaseTool] = useState(draw.baseTool);
  if (draw.baseTool !== lastBaseTool) {
    setLastBaseTool(draw.baseTool);
    if (draw.baseTool !== "select") setSelectedStrokeId(null);
  }

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

      if (draw.effectiveTool === "select") {
        const cursor = map.latLngToContainerPoint(event.latlng);
        let hit: Stroke | null = null;
        for (let i = layer.strokes.length - 1; i >= 0; i--) {
          const candidate = layer.strokes[i];
          if (candidate && hitTestStroke(candidate, cursor, map, bounds)) {
            hit = candidate;
            break;
          }
        }
        if (hit) {
          setSelectedStrokeId(hit.id);
          const next: MoveDrag = { strokeId: hit.id, original: hit, origin: point, current: point };
          moveDragRef.current = next;
          setMoveDrag(next);
        } else {
          setSelectedStrokeId(null);
        }
        return;
      }

      if (draw.effectiveTool === "rect") {
        const next: RectDrag = { start: point, current: point };
        rectDragRef.current = next;
        setRectDrag(next);
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

      const next: DrawingStroke =
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

      const currentMoveDrag = moveDragRef.current;
      if (currentMoveDrag) {
        const next: MoveDrag = { ...currentMoveDrag, current: point };
        moveDragRef.current = next;
        setMoveDrag(next);
        return;
      }

      const currentRectDrag = rectDragRef.current;
      if (currentRectDrag) {
        const next: RectDrag = { start: currentRectDrag.start, current: point };
        rectDragRef.current = next;
        setRectDrag(next);
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
      const next: DrawingStroke =
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

      const currentMoveDrag = moveDragRef.current;
      if (currentMoveDrag) {
        moveDragRef.current = null;
        setMoveDrag(null);
        const delta: FractionalPoint = {
          fx: currentMoveDrag.current.fx - currentMoveDrag.origin.fx,
          fy: currentMoveDrag.current.fy - currentMoveDrag.origin.fy,
        };
        if (delta.fx !== 0 || delta.fy !== 0) {
          const movedId = crypto.randomUUID();
          onChangeLayer(
            replaceStroke(layer, currentMoveDrag.strokeId, {
              ...translateStroke(currentMoveDrag.original, delta),
              id: movedId,
            }),
          );
          setSelectedStrokeId(movedId);
        }
        return;
      }

      const currentRectDrag = rectDragRef.current;
      if (currentRectDrag) {
        rectDragRef.current = null;
        setRectDrag(null);
        const isDegenerate =
          currentRectDrag.start.fx === currentRectDrag.current.fx &&
          currentRectDrag.start.fy === currentRectDrag.current.fy;
        if (!isDegenerate) {
          onChangeLayer(
            addStroke(layer, {
              id: crypto.randomUUID(),
              type: "rect",
              color: draw.color,
              width: draw.width,
              corner1: currentRectDrag.start,
              corner2: currentRectDrag.current,
              rotation: 0,
            }),
          );
        }
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

  // Lets a shape's line thickness change without ever releasing the mouse:
  // the scroll wheel is otherwise completely idle mid-drag (Leaflet's own
  // `scrollWheelZoom` is disabled the moment draw mode turns on, below), so
  // repurposing it here never fights the drag itself the way a held
  // modifier key would (Shift/Ctrl already momentarily swap to Circle/Erase
  // the instant draw mode is on; a third meaning on the same keys, active
  // only while the mouse also happens to be down, would be one more rule to
  // remember for every raid). A native listener, not a JSX `onWheel`: same
  // reasoning as `MapScreenLayout.tsx`'s own wheel listener (React's
  // synthetic wheel handler is passive, so `preventDefault()` there is a
  // silent no-op).
  const handleWheel = useCallback((event: WheelEvent) => {
    const { draw } = latestRef.current;
    if (!draw.drawModeOn) return;
    const dragging =
      activeStrokeRef.current !== null || isErasingRef.current || rectDragRef.current !== null;
    if (!dragging) return;
    event.preventDefault();
    const step = event.deltaY > 0 ? -1 : 1;
    const nextWidth = Math.min(STROKE_WIDTH_MAX, Math.max(STROKE_WIDTH_MIN, draw.width + step));
    draw.setWidth(nextWidth);
    if (activeStrokeRef.current) {
      const nextStroke = { ...activeStrokeRef.current, width: nextWidth };
      activeStrokeRef.current = nextStroke;
      setActiveStroke(nextStroke);
    }
  }, []);

  useEffect(() => {
    const container = map.getContainer();
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [map, handleWheel]);

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

  /** Starts a rotate-handle drag; see the `rotateDragRef`/`rotatePreviewRef` doc comment above for why this bypasses `useMapEvents` entirely. */
  function handleRotateHandleMouseDown(stroke: RectStroke, event: L.LeafletMouseEvent): void {
    L.DomEvent.stopPropagation(event);
    const { bounds } = latestRef.current;
    const corners = rectCorners(stroke, bounds);
    const centerLatLng = L.latLng(
      (corners[0].lat + corners[2].lat) / 2,
      (corners[0].lng + corners[2].lng) / 2,
    );
    const centerPx = map.latLngToContainerPoint(centerLatLng);
    const startPx = map.latLngToContainerPoint(event.latlng);
    const baseAngle = Math.atan2(startPx.y - centerPx.y, startPx.x - centerPx.x);
    rotateDragRef.current = {
      strokeId: stroke.id,
      original: stroke,
      centerPx,
      baseAngle,
      baseRotation: stroke.rotation,
    };

    function onMove(nativeEvent: MouseEvent): void {
      const current = rotateDragRef.current;
      if (!current) return;
      const px = map.mouseEventToContainerPoint(nativeEvent);
      const angle = Math.atan2(px.y - current.centerPx.y, px.x - current.centerPx.x);
      const deltaDeg = ((angle - current.baseAngle) * 180) / Math.PI;
      const next: RotatePreview = {
        strokeId: current.strokeId,
        rotation: current.baseRotation + deltaDeg,
      };
      rotatePreviewRef.current = next;
      setRotatePreview(next);
    }
    function onUp(): void {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const current = rotateDragRef.current;
      const preview = rotatePreviewRef.current;
      rotateDragRef.current = null;
      rotatePreviewRef.current = null;
      setRotatePreview(null);
      if (!current || !preview) return;
      const { layer, onChangeLayer } = latestRef.current;
      const rotatedId = crypto.randomUUID();
      onChangeLayer(
        replaceStroke(layer, current.strokeId, {
          ...current.original,
          rotation: preview.rotation,
          id: rotatedId,
        }),
      );
      setSelectedStrokeId(rotatedId);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /** Applies a live move or rotate preview to a committed stroke for rendering, without touching the actual layer until the drag commits on mouseup. */
  function withLiveEdits(stroke: Stroke): Stroke {
    if (moveDrag?.strokeId === stroke.id) {
      const delta: FractionalPoint = {
        fx: moveDrag.current.fx - moveDrag.origin.fx,
        fy: moveDrag.current.fy - moveDrag.origin.fy,
      };
      return translateStroke(stroke, delta);
    }
    if (rotatePreview?.strokeId === stroke.id && stroke.type === "rect") {
      return { ...stroke, rotation: rotatePreview.rotation };
    }
    return stroke;
  }

  const visibleStrokes = layer.strokes.map(withLiveEdits);
  const allVisibleStrokes = activeStroke ? [...visibleStrokes, activeStroke] : visibleStrokes;

  const selectedStroke = selectedStrokeId
    ? (visibleStrokes.find((stroke) => stroke.id === selectedStrokeId) ?? null)
    : null;
  const selectedRect = selectedStroke?.type === "rect" ? selectedStroke : null;

  return (
    <>
      <AnnotationToolbar
        drawModeOn={draw.drawModeOn}
        onToggleDrawMode={draw.toggleDrawMode}
        baseTool={draw.baseTool}
        onSelectTool={draw.setBaseTool}
        color={draw.color}
        onSelectColor={draw.setColor}
        width={draw.width}
        onChangeWidth={handleChangeWidth}
        onUndo={performUndo}
        onClear={handleClear}
        clearPending={pendingClearStash !== null}
        persistDrawingsAcrossReload={persistDrawingsAcrossReload}
        onTogglePersistDrawingsAcrossReload={setPersistDrawingsAcrossReload}
      />

      {sizePreview && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 z-[999] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-300 ease-out"
          style={{
            width: `${String(Math.max(10, Math.min(220, sizePreview.width * 4)))}px`,
            height: `${String(Math.max(10, Math.min(220, sizePreview.width * 4)))}px`,
            backgroundColor: sizePreview.color,
            opacity: sizePreview.fading ? 0 : 0.85,
          }}
          onTransitionEnd={() => {
            if (sizePreview.fading) setSizePreview(null);
          }}
        />
      )}

      {draw.drawModeOn && draw.effectiveTool === "circle" && (
        <div
          className="bg-card/90 border-border text-muted-foreground pointer-events-none absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm"
          aria-hidden="true"
        >
          Drag to size the circle. Scroll to change its line thickness.
        </div>
      )}

      {/*
        `interactive={false}` on every committed stroke: confirmed via a real
        browser test to be load-bearing, not cosmetic. Leaflet vector
        layers are interactive (hit-testable) by default, and a growing
        in-progress stroke/rect preview sits directly under the cursor at
        the exact moment the drag ends. An interactive layer's own mouseup
        handling stops the event from ever reaching the map container-level
        "mouseup" this component's `useMapEvents` relies on to commit the
        drag, silently freezing it mid-drag (confirmed: the committed
        stroke stayed pinned to its start point, mouseup never fired at
        all). The Select tool's own hit-testing is therefore entirely
        manual (`hitTestStroke`) rather than leaning on Leaflet's per-layer
        interactivity/click delegation; only the rotate handle
        (`CircleMarker` below) is a real interactive layer, since it needs a
        small precise grab target rather than whole-shape hit-testing.
        Deliberately a top-level prop, NOT inside `pathOptions`: react-leaflet
        only reads `interactive` at Leaflet layer construction time (from the
        component's own props), while `pathOptions` is reconciled later via a
        separate `setStyle()` effect that isn't guaranteed to retroactively
        tear down interaction listeners already wired up at creation.
      */}
      {allVisibleStrokes.map((stroke) => {
        const isSelected = draw.baseTool === "select" && stroke.id === selectedStrokeId;
        const dashArray = isSelected ? "6 4" : undefined;

        if (stroke.type === "circle") {
          return (
            <Circle
              key={stroke.id}
              center={fractionalToLatLng(stroke.center, bounds)}
              radius={planarDistance(
                fractionalToLatLng(stroke.center, bounds),
                fractionalToLatLng(stroke.edge, bounds),
              )}
              pathOptions={{ color: stroke.color, weight: stroke.width, dashArray }}
              interactive={false}
            />
          );
        }
        if (stroke.type === "rect") {
          return (
            <Polygon
              key={stroke.id}
              positions={rectCorners(stroke, bounds)}
              pathOptions={{
                color: stroke.color,
                weight: stroke.width,
                fillOpacity: 0.08,
                dashArray,
              }}
              interactive={false}
            />
          );
        }
        return (
          <Polyline
            key={stroke.id}
            positions={stroke.points.map((point) => toLatLngTuple(point, bounds))}
            pathOptions={{ color: stroke.color, weight: stroke.width, dashArray }}
            interactive={false}
          />
        );
      })}

      {draw.drawModeOn && draw.effectiveTool === "rect" && rectDrag && (
        <Rectangle
          bounds={[toLatLngTuple(rectDrag.start, bounds), toLatLngTuple(rectDrag.current, bounds)]}
          pathOptions={{
            color: draw.color,
            weight: draw.width,
            dashArray: "4 4",
            fillOpacity: 0.08,
          }}
          interactive={false}
        />
      )}

      {draw.baseTool === "select" && selectedRect && !moveDrag && (
        <CircleMarker
          center={rotateHandlePosition(selectedRect, bounds, map)}
          radius={7}
          pathOptions={{ color: "#101013", weight: 2, fillColor: "#7aa6dd", fillOpacity: 1 }}
          interactive
          eventHandlers={{
            mousedown: (event) => {
              handleRotateHandleMouseDown(selectedRect, event);
            },
          }}
        />
      )}
    </>
  );
}
