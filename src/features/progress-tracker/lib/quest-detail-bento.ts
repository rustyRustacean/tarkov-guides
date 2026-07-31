const PER_LINE_OVERHEAD = 24;

/**
 * Per-item overhead for sections whose entries render as icon tiles
 * (`RewardTileGrid` - Starting rewards/Rewards/If this task fails) rather
 * than plain text lines. A tile's real footprint (icon + label + padding,
 * arranged in a multi-column grid) is dominated by its fixed chrome, not
 * the label's character count - the opposite of {@link PER_LINE_OVERHEAD}'s
 * assumption for a plain text row. Without this, a several-tile reward
 * grid is under-weighted against the plain-text sections it competes with
 * for `selectFeaturedSectionIndex`'s full-width promotion. A tunable
 * heuristic, not exact - sanity-check visually against a few real
 * reward-heavy tasks if this ever looks wrong.
 */
export const TILE_PER_LINE_OVERHEAD = 90;

/**
 * Rough proxy for a section's rendered vertical size: total character length
 * of `lines` (one per rendered row/list-item) plus a fixed per-line overhead
 * (line-height/padding dominates a very short line's actual height more than
 * its character count does). Not real DOM measurement (unavailable before
 * first paint, and not worth the complexity for a cosmetic layout decision) -
 * just a monotonic-enough estimate for `selectFeaturedSectionIndex` to
 * compare sections against each other. `perLineOverhead` defaults to
 * {@link PER_LINE_OVERHEAD} (a plain text row) - pass
 * {@link TILE_PER_LINE_OVERHEAD} for a tile-grid section instead.
 */
export function estimateSectionWeight(
  lines: readonly string[],
  perLineOverhead: number = PER_LINE_OVERHEAD,
): number {
  return lines.reduce((total, line) => total + line.length + perLineOverhead, 0);
}

/**
 * Picks which section (if any) should span the full grid width in
 * `QuestDetailDialog`'s two-column bento layout - only relevant when the
 * visible section count is odd (an even count already tiles cleanly).
 * `weights` (one per section, same order they'll render, typically from
 * `estimateSectionWeight`) - the LARGEST-weight section is promoted: a
 * content-heavy section reads awkwardly squeezed into a half-width column
 * next to a much shorter neighbor, while a short section fills a half-width
 * cell fine - promoting the biggest one (not the smallest) is what keeps the
 * remaining paired cells' heights comparable to each other.
 */
export function selectFeaturedSectionIndex(weights: readonly number[]): number | null {
  if (weights.length < 2 || weights.length % 2 === 0) return null;
  let bestIndex = 0;
  let bestWeight = -Infinity;
  weights.forEach((weight, index) => {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestIndex = index;
    }
  });
  return bestIndex;
}
