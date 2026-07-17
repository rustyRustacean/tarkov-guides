export interface WheelZoomInput {
  currentZoom: number;
  /** `WheelEvent.deltaY` - positive scrolls down/away (zoom out), negative scrolls up/toward (zoom in). */
  deltaY: number;
  /** The content layer's current translate offset (`transform: translate(panX, panY) scale(zoom)`). */
  panX: number;
  panY: number;
  /** Cursor position relative to the viewport container (i.e. `event.clientX/Y - container.getBoundingClientRect().left/top`), not page coordinates. */
  cursorX: number;
  cursorY: number;
  minZoom: number;
  maxZoom: number;
}

export interface WheelZoomResult {
  zoom: number;
  /** The `panX`/`panY` to apply alongside `zoom` so the content point under the cursor stays under the cursor - the same anchor behavior as Google Maps' scroll-to-zoom. */
  panX: number;
  panY: number;
}

/** Multiplier applied to `deltaY` before exponentiating - tuned so one
 * standard mouse-wheel notch (`deltaY` ~100) changes zoom by ~15%, matching
 * the feel of a few notches to travel the whole zoom range. */
const WHEEL_SENSITIVITY = 0.0015;

/**
 * Cursor-anchored zoom math for `QuestTreeView`'s scroll-wheel zoom (Google
 * Maps-style: the content point under the cursor stays under the cursor
 * across the zoom change, rather than zooming around the viewport's
 * top-left origin). Pulled out of the component as a pure function since
 * `getBoundingClientRect()` returns all-zero rects in jsdom, making this
 * math impractical to unit-test through a simulated DOM wheel event -
 * the component only supplies real measurements and applies the result.
 *
 * Operates on `panX`/`panY` (a CSS `translate()` offset), not
 * `scrollLeft`/`scrollTop` - the viewport is a plain `overflow-hidden` div
 * with no native scrollbars (drag-to-pan + wheel-to-zoom are both hand-
 * rolled), so there's no browser-clamped scrollable range to fight, unlike
 * an earlier version of this component that used real scroll offsets.
 *
 * Derivation: `contentX/Y` is the content-space point under the cursor
 * before the zoom change (`(cursor - pan) / oldZoom`, inverting
 * `translate(pan) scale(zoom)`). After zooming, that same content point
 * must still be under the cursor, i.e. `contentX * newZoom + newPan =
 * cursor` - solved for `newPan`.
 */
export function computeWheelZoom(input: WheelZoomInput): WheelZoomResult {
  const factor = Math.exp(-input.deltaY * WHEEL_SENSITIVITY);
  const zoom = Math.min(input.maxZoom, Math.max(input.minZoom, input.currentZoom * factor));

  const contentX = (input.cursorX - input.panX) / input.currentZoom;
  const contentY = (input.cursorY - input.panY) / input.currentZoom;

  return {
    zoom,
    panX: input.cursorX - contentX * zoom,
    panY: input.cursorY - contentY * zoom,
  };
}
