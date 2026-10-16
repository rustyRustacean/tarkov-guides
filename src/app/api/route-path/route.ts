import { NextResponse } from "next/server";

import { exitPathAvailable } from "@/features/maps/lib/exit-path-maps";
import { routeMany } from "@/features/maps/server/route-service";

import type { Point, RouteTarget } from "@/features/maps/lib/exit-path";

/** Never cached: every answer depends on where the player is standing. */
export const dynamic = "force-dynamic";

const MAX_TARGETS = 40;
const MAX_POLYGONS = 60;
const MAX_POLYGON_POINTS = 400;
const MAX_ABS = 5000;

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_ABS;
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return isNumber(point.x) && isNumber(point.z);
}

function readPoints(value: unknown, max: number): Point[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const out: Point[] = [];
  for (const entry of value) {
    if (!isPoint(entry)) return null;
    out.push({ x: entry.x, z: entry.z });
  }
  return out;
}

/**
 * Walking routes over a map's private walkable data.
 *
 * Body: `{ map, from, to: [{x, z, y?}], minefields?: Point[][], anchors?: Point[] }`.
 * Reply: `{ routes: ({ points, length, detoured } | null)[] }`, one per target.
 * The walkable mesh itself never leaves the server.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "invalid body" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const map = input.map;
  if (typeof map !== "string" || !exitPathAvailable(map)) {
    return NextResponse.json({ message: "unknown map" }, { status: 400 });
  }
  if (!isPoint(input.from)) {
    return NextResponse.json({ message: "invalid start" }, { status: 400 });
  }
  const toRaw = input.to;
  if (!Array.isArray(toRaw) || toRaw.length === 0 || toRaw.length > MAX_TARGETS) {
    return NextResponse.json({ message: "invalid targets" }, { status: 400 });
  }
  const targets: RouteTarget[] = [];
  for (const entry of toRaw) {
    if (!isPoint(entry)) return NextResponse.json({ message: "invalid target" }, { status: 400 });
    const y = (entry as { y?: unknown }).y;
    targets.push({ x: entry.x, z: entry.z, ...(isNumber(y) ? { y } : {}) });
  }

  const minefields: Point[][] = [];
  if (input.minefields !== undefined) {
    if (!Array.isArray(input.minefields) || input.minefields.length > MAX_POLYGONS) {
      return NextResponse.json({ message: "invalid minefields" }, { status: 400 });
    }
    for (const polygon of input.minefields) {
      const points = readPoints(polygon, MAX_POLYGON_POINTS);
      if (points === null) {
        return NextResponse.json({ message: "invalid minefields" }, { status: 400 });
      }
      minefields.push(points);
    }
  }
  const anchors = input.anchors === undefined ? [] : readPoints(input.anchors, 200);
  if (anchors === null) return NextResponse.json({ message: "invalid anchors" }, { status: 400 });

  try {
    const routes = await routeMany(map, { x: input.from.x, z: input.from.z }, targets, minefields, [
      ...anchors,
      { x: input.from.x, z: input.from.z },
    ]);
    return NextResponse.json({ routes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "route failed";
    return NextResponse.json({ message }, { status: 502 });
  }
}
