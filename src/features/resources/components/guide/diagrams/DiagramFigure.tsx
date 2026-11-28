import type { ReactNode } from "react";

/**
 * The frame every guide diagram shares: a responsive inline SVG with an
 * accessible name, and a caption underneath that says the same thing in
 * words. Colors come from theme classes (`fill-status-*`, `fill-foreground`),
 * so diagrams follow whichever site theme is active.
 */
export function DiagramFigure({
  label,
  caption,
  viewBox,
  children,
}: {
  /** Short accessible name for the image. */
  label: string;
  caption: ReactNode;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <figure className="border-border bg-card my-8 rounded-lg border p-4">
      <svg
        role="img"
        aria-label={label}
        viewBox={viewBox}
        className="h-auto w-full"
        fontFamily="inherit"
      >
        {children}
      </svg>
      <figcaption className="text-muted-foreground mt-3 text-sm">{caption}</figcaption>
    </figure>
  );
}

/** A point on a circle, with 0° pointing right and angles turning counterclockwise (up), in SVG coordinates. */
export function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [cx + r * Math.cos(radians), cy - r * Math.sin(radians)];
}

/** An SVG path for a ring segment between two radii and two angles (see {@link polar}). */
export function annularSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  fromDeg: number,
  toDeg: number,
): string {
  const [ox1, oy1] = polar(cx, cy, outerR, fromDeg);
  const [ox2, oy2] = polar(cx, cy, outerR, toDeg);
  const [ix2, iy2] = polar(cx, cy, innerR, toDeg);
  const [ix1, iy1] = polar(cx, cy, innerR, fromDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return svgPath(
    "M",
    ox1,
    oy1,
    "A",
    outerR,
    outerR,
    0,
    large,
    0,
    ox2,
    oy2,
    "L",
    ix2,
    iy2,
    ...(innerR > 0 ? ["A", innerR, innerR, 0, large, 1, ix1, iy1] : ["L", ix1, iy1]),
    "Z",
  );
}

/** Joins SVG path commands and coordinates, rounding numbers to 2 decimals. */
export function svgPath(...parts: readonly (string | number)[]): string {
  return parts.map((part) => (typeof part === "number" ? Number(part.toFixed(2)) : part)).join(" ");
}
