import { NextResponse } from "next/server";

import { eventRoomIdForCode, isEventCode } from "@/features/events/lib/event-code";
import { parseEventDocument } from "@/features/events/lib/event-schema";

import { cdnCacheHeaders, NO_STORE } from "../../../lib/cache-headers";
import { getLiveblocksServerClient } from "../../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../../maps-session/rate-limit";
import { isRoomNotFound } from "../../lib/event-keys";

import type { NextRequest } from "next/server";

/**
 * Seconds Vercel's CDN may serve one snapshot (and 10 more stale while it
 * refreshes). Every viewer of a busy scoreboard then costs at most one
 * Liveblocks read per 5 seconds in total, however many people are watching.
 * Why browsers get a different header: `cdnCacheHeaders`.
 */
const SNAPSHOT_CACHE_HEADERS = cdnCacheHeaders(5, 10);

function errorResponse(status: number, error: string, reason: string): NextResponse {
  return NextResponse.json({ error, reason }, { status, headers: NO_STORE });
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
