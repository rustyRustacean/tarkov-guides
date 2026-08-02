"use client";

import { useState } from "react";

import { cn } from "@/shared/ui/lib/cn";

import { getTraderOutlineColor } from "../selectors/trader-grouping";

interface TraderRemainingSlice {
  traderName: string;
  remaining: number;
}

interface TraderRemainingPieChartProps {
  data: readonly TraderRemainingSlice[];
}

const VIEWBOX_SIZE = 100;
const CENTER = VIEWBOX_SIZE / 2;
const RADIUS = 34;
const STROKE_WIDTH = 15;
const HOVER_STROKE_WIDTH = STROKE_WIDTH + 4;
/** Gap between adjacent slices, in `pathLength` percent units - the ring is drawn with `pathLength={100}`, so 1 unit = 1% of the full circle. */
const SLICE_GAP_PERCENT = 1.5;
/** Floor so a trader with very few remaining tasks against a large total still renders a visible sliver instead of vanishing under the gap. */
const MIN_SLICE_PERCENT = 0.6;

/**
 * Donut chart breaking down remaining (not-yet-done) tasks by trader. Built
 * from stacked full-circle `<circle>`s sliced via `stroke-dasharray` +
 * `pathLength` rather than hand-rolled arc-path math, so each trader's slice
 * is one simple element. Reuses `getTraderOutlineColor` (the same
 * per-trader color already used for `QuestTreeView`'s node outlines/legend)
 * so a trader reads as the same color everywhere in the app.
 *
 * The SVG is decorative (`aria-hidden`) - the legend list beside it carries
 * the same name+value pairs as real, keyboard-reachable text, so nothing is
 * gated behind hovering the chart itself.
 */
export function TraderRemainingPieChart({ data }: TraderRemainingPieChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((sum, slice) => sum + slice.remaining, 0);

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No remaining tasks - every trader is fully complete.
      </p>
    );
  }

  // Each slice's start offset is (purely, no shared mutable accumulator) the
  // share of the circle taken by every slice before it.
  const segments = data.map((slice, index) => {
    const precedingRemaining = data
      .slice(0, index)
      .reduce((sum, preceding) => sum + preceding.remaining, 0);
    const rawPercent = (slice.remaining / total) * 100;
    const percent = Math.max(rawPercent - SLICE_GAP_PERCENT, MIN_SLICE_PERCENT);
    const offset = -(precedingRemaining / total) * 100;
    return { ...slice, percent, offset };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${String(VIEWBOX_SIZE)} ${String(VIEWBOX_SIZE)}`}
          width={140}
          height={140}
          aria-hidden="true"
        >
          <g transform={`rotate(-90 ${String(CENTER)} ${String(CENTER)})`}>
            {segments.map((segment) => (
              <circle
                key={segment.traderName}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                strokeWidth={hovered === segment.traderName ? HOVER_STROKE_WIDTH : STROKE_WIDTH}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${String(segment.percent)} ${String(100 - segment.percent)}`}
                strokeDashoffset={segment.offset}
                style={{ stroke: getTraderOutlineColor(segment.traderName) }}
                className="transition-[stroke-width] duration-150"
                onMouseEnter={() => {
                  setHovered(segment.traderName);
                }}
                onMouseLeave={() => {
                  setHovered(null);
                }}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
            remaining
          </span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-1">
        {data.map((slice) => (
          <li
            key={slice.traderName}
            className={cn(
              "flex items-center gap-2 rounded-sm px-1.5 py-1 text-sm transition-colors",
              hovered === slice.traderName && "bg-accent",
            )}
            onMouseEnter={() => {
              setHovered(slice.traderName);
            }}
            onMouseLeave={() => {
              setHovered(null);
            }}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: getTraderOutlineColor(slice.traderName) }}
            />
            <span className="truncate">{slice.traderName}</span>
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {slice.remaining}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
