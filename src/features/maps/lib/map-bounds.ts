import type { Point } from "./exit-path";

/** An axis-aligned box in game meters. */
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * The box around flat polygon/line layers (`[x0, z0, x1, z1, ...]`) and
 * loose points, or `null` when there is nothing to measure.
 */
export function boundsOf(
  layers: readonly (readonly (readonly number[])[])[],
  points: readonly Point[],
): Bounds | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const take = (x: number, z: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };
  for (const layer of layers) {
    for (const flat of layer) {
      for (let i = 0; i + 1 < flat.length; i += 2) take(flat[i] ?? 0, flat[i + 1] ?? 0);
    }
  }
  for (const p of points) take(p.x, p.z);
  return Number.isFinite(minX) ? { minX, maxX, minZ, maxZ } : null;
}

/** Whether a point lies inside the box, allowing `margin` meters of slack on every side. */
export function withinBounds(bounds: Bounds, point: Point, margin: number): boolean {
  return (
    point.x >= bounds.minX - margin &&
    point.x <= bounds.maxX + margin &&
    point.z >= bounds.minZ - margin &&
    point.z <= bounds.maxZ + margin
  );
}
