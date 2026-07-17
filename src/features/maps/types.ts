/**
 * A point in image-local fractional coordinates (`0..1` relative to the
 * underlying map image's width/height) - resolution-independent, and
 * convertible to a real Leaflet `LatLng` at render time via the same
 * bounds math the active variant's `ImageOverlay`/CRS already computes.
 * Chosen over legacy's raw image-pixel coordinates (`old/TarkovTrackerWB-main/
 * src/components/maps/annotations.js`) because there's no longer a single
 * shared CSS transform between the image and a drawing canvas to piggyback
 * on once every variant renders through react-leaflet - see
 * `src/features/maps/README.md` for the full rationale.
 */
export interface FractionalPoint {
  fx: number;
  fy: number;
}

interface StrokeBase {
  id: string;
  color: string;
  width: number;
}

/**
 * One drawn shape. `pen` carries a freehand point path; `circle` carries a
 * center + a point on its edge (rather than a raw radius) so it converts to
 * real geometry the same way a pen stroke does - project both points
 * through the active CRS and take the distance between them. Ported from
 * `annotations.js`'s stroke shapes, with two deliberate deviations: `line`
 * isn't modeled (legacy's own toolbar has no button for it - shortcuts were
 * removed "per user request", so it's dead UI, not a gap) and there is no
 * `erase` stroke variant - legacy's own Leaflet-variant eraser is confirmed
 * non-functional (a same-color dashed mark that doesn't remove anything;
 * only its raster-canvas variant does a real erase, via `destination-out`
 * canvas compositing that doesn't fit this port's vector-geometry
 * rendering). This port's eraser instead destructively trims/removes
 * `pen`/`circle` strokes in place (see `lib/annotations.ts`'s `eraseNear`) -
 * a real functional eraser never needs to persist a stroke of its own.
 */
export type Stroke =
  | (StrokeBase & { type: "pen"; points: readonly FractionalPoint[] })
  | (StrokeBase & { type: "circle"; center: FractionalPoint; edge: FractionalPoint });

/** A protected rectangle - strokes fully inside it are skipped by undo/clear. Ported from `annotations.js`'s lock rects. */
export interface LockRect {
  id: string;
  corner1: FractionalPoint;
  corner2: FractionalPoint;
}

/** One map+variant's drawing layer. */
export interface MapAnnotationLayer {
  strokes: readonly Stroke[];
  locks: readonly LockRect[];
}

/**
 * Everything about the Maps feature that's scoped to one profile - mirrors
 * legacy's confirmed per-profile bucketing of `mapAnnotations`/`mapDisplay`
 * (`old/TarkovTrackerWB-main/src/components/profile/profile.js`). Kept as
 * this feature's own bucket, keyed by Progress Tracker's `activeProfileId`
 * (read, never written, via `useProgressTrackerStore.getState()`) rather
 * than folded into `ProfileProgress` - see `store.ts`'s doc comment.
 */
export interface MapProfileState {
  /** mapNormalizedName -> variantId -> layer. */
  annotations: Readonly<Record<string, Readonly<Record<string, MapAnnotationLayer>>>>;
  /** taskId -> manual "show this task's marker on the map" override. Absent = default (only `inprog` tasks show). Purely cosmetic - never affects task status. */
  taskDisplayOverrides: Readonly<Record<string, boolean>>;
}

/** A fresh, empty per-profile Maps state - no drawings, no display overrides. */
export function emptyMapProfileState(): MapProfileState {
  return { annotations: {}, taskDisplayOverrides: {} };
}

/** A user-uploaded custom map image variant's metadata - the actual image bytes live in IndexedDB (see `persistence/idb.ts`), never here. */
export interface CustomMapEntry {
  id: string;
  label: string;
  custom: true;
}
