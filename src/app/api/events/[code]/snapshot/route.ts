import { NextResponse } from "next/server";

import { eventRoomIdForCode, isEventCode } from "@/features/events/lib/event-code";
import { parseEventDocument } from "@/features/events/lib/event-schema";

import { getLiveblocksServerClient } from "../../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../../maps-session/rate-limit";
import { isRoomNotFound } from "../../lib/event-keys";

import type { NextRequest } from "next/server";

/**
 * Seconds a shared cache (Vercel's CDN) may serve one snapshot. Every
 * viewer of a busy scoreboard then costs at most one Liveblocks read per
 * this many seconds in total, however many people are watching.
 *
 * Set through `CDN-Cache-Control` (RFC 9213, honored by Vercel's CDN), with
 * the browser-facing `Cache-Control` saying "always revalidate". Putting
 * `stale-while-revalidate` in the plain `Cache-Control` instead let browsers
 * keep showing a stale scoreboard for up to 10 s after each poll (measured
 * 2026-11-22: ~14 s from a score change to a viewer seeing it, versus
 * ~100 ms for Liveblocks itself).
 */
const SHARED_MAX_AGE_S = 5;

const SNAPSHOT_CACHE_HEADERS = {
  "cache-control": "public, max-age=0, must-revalidate",
  "cdn-cache-control": `public, max-age=${String(SHARED_MAX_AGE_S)}, stale-while-revalidate=${String(SHARED_MAX_AGE_S * 2)}`,
};

function errorResponse(status: number, error: string, reason: string): NextResponse {
  return NextResponse.json({ error, reason }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * The view-only scoreboard's data: the event room's storage, read server
 * side, re-validated, with the editors' activity log removed (scorer names
 * and change history are for editors only). View-only pages and the stream
 * overlay poll this instead of joining the room, so viewers are never
 * Liveblocks users and can't write anything.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!isEventCode(code)) {
    return errorResponse(404, "not-found", "No event with that code.");
  }
  if (!checkRateLimit(`event-snapshot:${clientIpFrom(request)}`, 120, 60_000)) {
    return errorResponse(429, "rate-limited", "Refreshing too often. Try again shortly.");
  }

  try {
    const storage = await getLiveblocksServerClient().getStorageDocument(
      eventRoomIdForCode(code),
      "json",
    );
    const document = parseEventDocument(storage);
    if (!document) return errorResponse(404, "not-found", "No event with that code.");
    return NextResponse.json(
      { document: { ...document, activity: [] }, fetchedAt: Date.now() },
      { headers: SNAPSHOT_CACHE_HEADERS },
    );
  } catch (error) {
    if (isRoomNotFound(error)) return errorResponse(404, "not-found", "No event with that code.");
    return errorResponse(500, "server-error", "The scoreboard is unavailable right now.");
  }
}
