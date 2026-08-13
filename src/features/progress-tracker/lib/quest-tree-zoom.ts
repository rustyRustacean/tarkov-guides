export interface WheelZoomInput {
  currentZoom: number;
  /** `WheelEvent.deltaY`: positive scrolls down/away (zoom out), negative scrolls up/toward (zoom in). */
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
  /** The `panX`/`panY` to apply alongside `zoom` so the content point under the cursor stays under the cursor, the same anchor behavior as Google Maps' scroll-to-zoom. */
  panX: number;
  panY: number;
}

/** Multiplier applied to `deltaY` before exponentiating: tuned so one
 * standard mouse-wheel notch (`deltaY` ~100) changes zoom by ~15%, matching
 * the feel of a few notches to travel the whole zoom range. */
const WHEEL_SENSITIVITY = 0.0015;

/**
 * Cursor-anchored zoom math for `QuestTreeView`'s scroll-wheel zoom (Google
 * Maps-style: the content point under the cursor stays under the cursor
 * across the zoom change, rather than zooming around the viewport's
 * top-left origin). Pulled out of the component as a pure function since
 * `getBoundingClientRect()` returns all-zero rects in jsdom, making this
 * math impractical to unit-test through a simulated DOM wheel event: the
 * component only supplies real measurements and applies the result.
 *
 * Operates on `panX`/`panY` (a CSS `translate()` offset), not
 * `scrollLeft`/`scrollTop`: the viewport is a plain `overflow-hidden` div
 * with no native scrollbars (drag-to-pan + wheel-to-zoom are both
 * hand-rolled), so there's no browser-clamped scrollable range to fight,
 * unlike an earlier version of this component that used real scroll
 * offsets.
 *
 * Derivation: `contentX/Y` is the content-space point under the cursor
 * before the zoom change (`(cursor - pan) / oldZoom`, inverting
 * `translate(pan) scale(zoom)`). After zooming, that same content point
 * must still be under the cursor, i.e. `contentX * newZoom + newPan =
 * cursor`, solved for `newPan`.
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

/** Vertical inset (px) from the viewport's top edge a trader jump lands at, not flush against the border. */
export const TRADER_JUMP_TOP_INSET = 24;

/**
 * Pans so a trader lane's header lands at the viewport's top-CENTER ("jump
 * to the start of" that trader's chain) at the given zoom level, without
 * changing zoom itself. Shared by `QuestTreeView`'s per-trader "Jump to"
 * toolbar buttons and its initial-mount auto-jump (see that component's
 * doc comment). `viewportPoint = contentPoint * zoom + pan` (same relation
 * `computeWheelZoom`'s doc comment derives), solved for `pan` with the
 * viewport-side x pinned to the viewport's horizontal midpoint (not its left
 * edge) so the lane centers instead of hugging the left side. Takes
 * `headerX`/`headerWidth` (the lane's top-layer node span, not its raw
 * `x`/`width`; see `QuestTreeLane`'s doc comment) so this centers the first
 * visible node rather than the lane's sometimes-wider bounding box.
 */
export function computeTraderJumpPan(
  lane: { headerX: number; headerWidth: number },
  viewportWidth: number,
  zoom: number,
): { x: number; y: number } {
  const laneHeaderCenterX = lane.headerX + lane.headerWidth / 2;
  return { x: viewportWidth / 2 - laneHeaderCenterX * zoom, y: TRADER_JUMP_TOP_INSET };
}

/** Zoom level a task search jump snaps to, the same "1x" level the Reset button targets, so a search result always lands at a comfortably readable size regardless of whatever zoom the user was previously at (unlike "Jump to trader", which deliberately leaves zoom untouched; see that function's doc comment). */
export const TASK_SEARCH_FOCUS_ZOOM = 1;

/**
 * Pans so a task (or chain-part) node's CENTER lands at the viewport's own
 * center, at `zoom`: the "autozoom to the task" behavior of the quest
 * search box. Unlike `computeTraderJumpPan` (which only centers
 * horizontally and pins a fixed top inset, since a lane header is always
 * the topmost thing in its column), a searched task can be anywhere in the
 * layout's vertical extent too, so both axes solve the same
 * `viewportPoint = contentPoint * zoom + pan` relation.
 */
export function computeTaskFocusPan(
  node: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
): { x: number; y: number } {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  return {
    x: viewportWidth / 2 - centerX * zoom,
    y: viewportHeight / 2 - centerY * zoom,
  };
}
