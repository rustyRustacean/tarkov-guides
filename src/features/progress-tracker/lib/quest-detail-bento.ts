const PER_LINE_OVERHEAD = 24;

/**
 * Rough proxy for a section's rendered vertical size: total character length
 * of `lines` (one per rendered row/list-item) plus a fixed per-line overhead
 * (line-height/padding dominates a very short line's actual height more than
 * its character count does). Not real DOM measurement (unavailable before
 * first paint, and not worth the complexity for a cosmetic layout decision) -
 * just a monotonic-enough estimate for `selectFeaturedSectionIndex` to
 * compare sections against each other.
 */
export function estimateSectionWeight(lines: readonly string[]): number {
  return lines.reduce((total, line) => total + line.length + PER_LINE_OVERHEAD, 0);
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
