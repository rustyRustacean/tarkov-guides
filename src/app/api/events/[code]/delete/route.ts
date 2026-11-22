import { NextResponse } from "next/server";

import { eventRoomIdForCode, isEditKey, isEventCode } from "@/features/events/lib/event-code";

import { getLiveblocksServerClient } from "../../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../../maps-session/rate-limit";
import { verifyEventEditKey } from "../../lib/event-keys";

import type { NextRequest } from "next/server";

function errorResponse(status: number, error: string, reason: string): NextResponse {
  return NextResponse.json({ error, reason }, { status });
}

/** Permanently deletes an event (its room and everything in it). Needs the edit key. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!checkRateLimit(`event-delete:${clientIpFrom(request)}`, 10, 60_000)) {
    return errorResponse(429, "rate-limited", "Too many attempts. Try again shortly.");
  }

  let editKey: unknown;
  try {
    editKey = ((await request.json()) as { editKey?: unknown }).editKey;
  } catch {
    return errorResponse(400, "invalid-input", "Malformed request body.");
  }
  if (!isEventCode(code) || !isEditKey(editKey)) {
    return errorResponse(400, "invalid-input", "Missing or malformed fields.");
  }

  try {
    const liveblocks = getLiveblocksServerClient();
    const check = await verifyEventEditKey(liveblocks, code, editKey);
    if (check === "not-found") return NextResponse.json({ deleted: true });
    if (check === "forbidden") {
      return errorResponse(403, "forbidden", "This edit link isn't valid for this event.");
    }
    await liveblocks.deleteRoom(eventRoomIdForCode(code));
    return NextResponse.json({ deleted: true });
  } catch {
    return errorResponse(500, "server-error", "Events are unavailable right now.");
  }
}
