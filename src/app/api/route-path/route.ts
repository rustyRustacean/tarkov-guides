import { NextResponse } from "next/server";

import { exitPathAvailable } from "@/features/maps/lib/exit-path-maps";
import { MAX_COORDINATE_M, MAX_TARGETS } from "@/features/maps/lib/route-limits";
import { retryAfterSeconds } from "@/features/maps/server/rate-limit";
import { routeMany } from "@/features/maps/server/route-service";

import type { Point, RouteTarget } from "@/features/maps/lib/exit-path";

/** Never cached: every answer depends on where the player is standing. */
export const dynamic = "force-dynamic";

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE_M;
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return isNumber(point.x) && isNumber(point.z);
}

function clientOf(request: Request): string {
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first !== undefined && first !== "" ? first : "unknown";
}

/**
 * Walking routes over a map's private walkable data.
 *
 * Body: `{ map, from, to: [{x, z, y?}] }`. The map's minefields and exit
 * positions are the server's own, so none are accepted from the browser.
 * Reply: `{ routes: ({ points, length, detoured } | null)[] }`, one per target;
 * a start or target off the map has no route.
 * The walkable mesh itself never leaves the server.
 */
export async function POST(request: Request) {
  const wait = retryAfterSeconds(clientOf(request));
  if (wait > 0) {
    return NextResponse.json(
      { message: "too many requests" },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

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

  const started = Date.now();
  try {
    const { routes, stats } = await routeMany(map, { x: input.from.x, z: input.from.z }, targets);
    console.info(
      "[route-path]",
      JSON.stringify({ map, targets: targets.length, ms: Date.now() - started, ...stats }),
    );
    return NextResponse.json({ routes });
  } catch (error) {
    console.error("[route-path] route failed:", error);
    return NextResponse.json({ message: "route failed" }, { status: 502 });
  }
}
