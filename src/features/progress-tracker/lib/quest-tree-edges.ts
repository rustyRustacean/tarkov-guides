const EDGE_LABEL_GAP = 6;

/**
 * SVG `<path>` `d` for one prerequisite edge. Same-trader edges get a single
 * horizontal jog at the vertical midpoint (an orthogonal "elbow"/step
 * connector, visually distinct from a diagonal line); cross-trader edges
 * (or same-trader ones that already share an x, where a jog would be a
 * no-op) stay a straight diagonal. Edges always run source-bottom-center
 * (shallower layer) -> target-top-center (deeper layer) - see
 * `computeQuestTreeLayout`'s doc comment - so `y2 >= y1` always holds and
 * the elbow's single jog is never ambiguous.
 */
export function buildEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sameTrader: boolean,
): string {
  if (!sameTrader || x1 === x2)
    return `M ${String(x1)} ${String(y1)} L ${String(x2)} ${String(y2)}`;
  const midY = y1 + (y2 - y1) / 2;
  return `M ${String(x1)} ${String(y1)} L ${String(x1)} ${String(midY)} L ${String(x2)} ${String(midY)} L ${String(x2)} ${String(y2)}`;
}

export interface EdgeLabelPositions {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/**
 * Hover-only label anchor points for a cross-trader edge: the FROM task's
 * name sits just below the source node's bottom edge (the line's start,
 * "above" the line's downward path), the TO task's name sits just above the
 * target node's top edge (the line's end, "below" the line) - both land
 * inside the empty row-gap band between the two rows, never overlapping
 * either node.
 */
export function computeEdgeLabelPositions(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EdgeLabelPositions {
  return {
    from: { x: x1, y: y1 + EDGE_LABEL_GAP },
    to: { x: x2, y: y2 - EDGE_LABEL_GAP },
  };
}
