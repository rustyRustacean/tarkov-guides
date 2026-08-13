/**
 * Pure drag-decision math for the mobile bottom sheet, ported from
 * `old/TarkovTrackerWB-main/src/components/layout/routing.js`'s
 * `_initSheetDrag`/`end()`. Kept fully separate from any DOM/pointer-event
 * wiring (that's `hooks/use-sheet-drag.ts`) so the tap/flick/height-fraction
 * decision logic is directly unit-testable, matching this project's "pure
 * lib function + thin wiring hook" split.
 */

/** Sheet height (px) when closed: just the handle. */
export const CLOSED_PX = 46;
/** Never let the sheet cover more than this fraction of the container. */
export const MAX_FRACTION = 0.9;
/** The "open" snap height, as a fraction of the container's height. */
export const OPEN_FRACTION = 0.74;
/** Total movement below this (px) is treated as a tap, not a drag. */
export const TAP_THRESHOLD_PX = 6;
/** A release velocity beyond this (px/ms) forces open (upward) or closed (downward), regardless of position. */
export const SNAP_VELOCITY_PX_PER_MS = 0.35;
/** Below the velocity threshold, released position past this fraction of the container height snaps open. */
export const SNAP_HEIGHT_FRACTION = 0.35;

/** The sheet's resting bottom-height (px) for a given open/closed state; `startBot` in legacy's drag-start handler. */
export function restingHeightPx(open: boolean, containerHeightPx: number): number {
  return open ? Math.round(containerHeightPx * OPEN_FRACTION) : CLOSED_PX;
}

/** Clamps a live-drag height (px) between fully closed and `MAX_FRACTION` of the container; `bot` in legacy's `pointermove` handler. */
export function clampSheetHeight(px: number, containerHeightPx: number): number {
  return Math.max(CLOSED_PX, Math.min(containerHeightPx * MAX_FRACTION, px));
}

export interface SnapDecisionInput {
  /** Maximum absolute pointer movement (px) observed during the drag. */
  movedPx: number;
  /** Release velocity in px/ms: negative is upward (toward open), positive downward. */
  velocityPxPerMs: number;
  /** The sheet's height (px) at the moment of release. */
  currentBottomPx: number;
  containerHeightPx: number;
  /** The sheet's open/closed state before this interaction; only consulted for the tap case. */
  currentlyOpen: boolean;
}

/**
 * The release-time open/closed decision, ported from `_initSheetDrag`'s
 * `end()`. Three cases, checked in order: (1) total movement under
 * {@link TAP_THRESHOLD_PX} is a tap, toggling the prior state; (2) a fast
 * flick (beyond {@link SNAP_VELOCITY_PX_PER_MS}) forces open/closed
 * regardless of where it was released; (3) otherwise, snap based on whether
 * the release position was past {@link SNAP_HEIGHT_FRACTION} of the
 * container's height.
 */
export function computeSnapDecision(input: SnapDecisionInput): boolean {
  const { movedPx, velocityPxPerMs, currentBottomPx, containerHeightPx, currentlyOpen } = input;
  if (movedPx < TAP_THRESHOLD_PX) return !currentlyOpen;
  if (velocityPxPerMs < -SNAP_VELOCITY_PX_PER_MS) return true;
  if (velocityPxPerMs > SNAP_VELOCITY_PX_PER_MS) return false;
  return currentBottomPx > containerHeightPx * SNAP_HEIGHT_FRACTION;
}
