export const MIN_PERCENT = 0;
export const MAX_PERCENT = 100;

/** The reveal position the intro animation settles on: short of 100 so the handle stays visible/grabbable inside the frame instead of sitting flush against (and partly clipped by) the card's edge. */
export const INTRO_REVEAL_PERCENT = 88;

const ARROW_STEP = 5;
const PAGE_STEP = 10;

/** Clamps to the slider's valid 0-100 range. */
export function clampPercent(value: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));
}

/** Converts a pointer's `clientX` to a 0-100 position within a container's bounding rect. */
export function percentFromClientX(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) return 50;
  return clampPercent(((clientX - rect.left) / rect.width) * 100);
}

/**
 * The next slider position for a keyboard interaction on the divider,
 * per the WAI-ARIA APG slider pattern (arrows nudge, Page Up/Down jump
 * further, Home/End go to the ends). Returns `null` for any other key, so
 * the caller knows not to call `preventDefault()`/re-render for it.
 */
export function nextPercentFromKey(current: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clampPercent(current - ARROW_STEP);
    case "ArrowRight":
    case "ArrowUp":
      return clampPercent(current + ARROW_STEP);
    case "PageDown":
      return clampPercent(current - PAGE_STEP);
    case "PageUp":
      return clampPercent(current + PAGE_STEP);
    case "Home":
      return MIN_PERCENT;
    case "End":
      return MAX_PERCENT;
    default:
      return null;
  }
}
