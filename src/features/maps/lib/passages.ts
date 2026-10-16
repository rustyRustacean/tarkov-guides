/**
 * Gates and gateways, found as gaps in the fence lines.
 *
 * The game's walkable mesh was baked with doors and gates shut, so a gate you
 * can walk through is a solid wall to it. The map's fence lines stop where a
 * gate is, so a short gap between two fence ends is a passage. Each is
 * returned as the segment between the two ends; the router bridges the mesh
 * across it.
 *
 * Deliberately conservative: a gap that touches a building or water is a break
 * in the drawing, not a gate, and is dropped; so is anything too narrow to
 * stand in or too wide to be a gate.
 */

export type Passage = readonly [x1: number, z1: number, x2: number, z2: number];

/** Gate-sized openings, in metres. */
const MIN_GAP = 1.5;
const MAX_GAP = 8;

function pointInFlat(x: number, z: number, poly: readonly number[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i] ?? 0;
    const zi = poly[i + 1] ?? 0;
    const xj = poly[j] ?? 0;
    const zj = poly[j + 1] ?? 0;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): boolean {
  const o = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) =>
    (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  return (
    o(ax, az, bx, bz, cx, cz) * o(ax, az, bx, bz, dx, dz) < 0 &&
    o(cx, cz, dx, dz, ax, az) * o(cx, cz, dx, dz, bx, bz) < 0
  );
}

/** Does the segment pass through (or end in) any polygon? */
function touches(
  polygons: readonly (readonly number[])[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  for (const poly of polygons) {
    if (pointInFlat(mx, mz, poly) || pointInFlat(ax, az, poly) || pointInFlat(bx, bz, poly)) {
      return true;
    }
    for (let i = 0; i < poly.length; i += 2) {
      const j = (i + 2) % poly.length;
      if (
        segmentsCross(
          ax,
          az,
          bx,
          bz,
          poly[i] ?? 0,
          poly[i + 1] ?? 0,
          poly[j] ?? 0,
          poly[j + 1] ?? 0,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Gaps between the ends of open fence polylines that look like gates.
 * `fences` are flat `[x0, z0, x1, z1, ...]` polylines; `blockers` are the
 * polygons a gate cannot be inside (buildings, water).
 */
export function findFenceGaps(
  fences: readonly (readonly number[])[],
  blockers: readonly (readonly number[])[],
): Passage[] {
  interface End {
    line: number;
    x: number;
    z: number;
    /** The fence's own direction at this end (pointing away from the fence). */
    dx: number;
    dz: number;
  }
  const ends: End[] = [];
  fences.forEach((line, index) => {
    if (line.length < 4) return;
    const n = line.length;
    const first = { x: line[0] ?? 0, z: line[1] ?? 0 };
    const second = { x: line[2] ?? 0, z: line[3] ?? 0 };
    const last = { x: line[n - 2] ?? 0, z: line[n - 1] ?? 0 };
    const prev = { x: line[n - 4] ?? 0, z: line[n - 3] ?? 0 };
    // A closed loop has no free ends.
    if (Math.hypot(first.x - last.x, first.z - last.z) < 0.3) return;
    ends.push({
      line: index,
      x: first.x,
      z: first.z,
      dx: first.x - second.x,
      dz: first.z - second.z,
    });
    ends.push({ line: index, x: last.x, z: last.z, dx: last.x - prev.x, dz: last.z - prev.z });
  });

  const found: Passage[] = [];
  const used = new Set<number>();
  for (let i = 0; i < ends.length; i += 1) {
    const a = ends[i];
    if (!a) continue;
    // The closest free end of another fence within gate range.
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < ends.length; j += 1) {
      const b = ends[j];
      if (!b || j === i || b.line === a.line) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d >= MIN_GAP && d <= MAX_GAP && d < bestDist) {
        best = j;
        bestDist = d;
      }
    }
    const b = best >= 0 ? ends[best] : undefined;
    if (!b || used.has(i) || used.has(best)) continue;
    // Mutual nearest, so one end is not paired twice.
    let mutual = true;
    for (let k = 0; k < ends.length; k += 1) {
      const c = ends[k];
      if (!c || k === best || c.line === b.line) continue;
      if (Math.hypot(b.x - c.x, b.z - c.z) < bestDist - 1e-6) {
        mutual = false;
        break;
      }
    }
    if (!mutual) continue;
    // The two fences should point at each other across the gap, not run side by side.
    const gx = b.x - a.x;
    const gz = b.z - a.z;
    const alongA = (a.dx * gx + a.dz * gz) / (Math.hypot(a.dx, a.dz) * bestDist || 1);
    const alongB = (b.dx * -gx + b.dz * -gz) / (Math.hypot(b.dx, b.dz) * bestDist || 1);
    if (alongA < 0.2 && alongB < 0.2) continue;
    if (touches(blockers, a.x, a.z, b.x, b.z)) continue;
    used.add(i);
    used.add(best);
    found.push([a.x, a.z, b.x, b.z]);
  }
  return found;
}
