import { NextResponse } from "next/server";

import { eventRoomIdForCode, isEditKey, isEventCode } from "@/features/events/lib/event-code";
import { cleanText, EVENT_LIMITS } from "@/features/events/lib/event-schema";

import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../maps-session/rate-limit";
import { verifyEventEditKey } from "../lib/event-keys";

const PARTICIPANT_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function errorResponse(status: number, error: string, reason: string): NextResponse {
  return NextResponse.json({ error, reason }, { status });
}

/**
 * Mints a write token for an event room. Only editors connect to the room
 * (viewers poll the snapshot route), so every token here is `room:write`,
 * and every one needs the event's edit key, checked against the hash stored
 * in room metadata at creation.
 *
 * `participantId` is a random per-browser id (Liveblocks bills per unique
 * user id, so it's stable across reloads). `displayName` is whatever the
 * scorer typed; it labels their changes in the activity log and is not
 * verified, the edit key is the only credential.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIpFrom(request);
  if (!checkRateLimit(`event-token:${ip}`, 30, 60_000)) {
    return errorResponse(429, "rate-limited", "Too many attempts. Try again shortly.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid-input", "Malformed request body.");
  }
  if (typeof body !== "object" || body === null) {
    return errorResponse(400, "invalid-input", "Missing fields.");
  }
  const { code, editKey, participantId, displayName } = body as Record<string, unknown>;
  if (
    !isEventCode(code) ||
    !isEditKey(editKey) ||
    typeof participantId !== "string" ||
    !PARTICIPANT_ID_PATTERN.test(participantId)
  ) {
    return errorResponse(400, "invalid-input", "Missing or malformed fields.");
  }

  try {
    const liveblocks = getLiveblocksServerClient();
    const check = await verifyEventEditKey(liveblocks, code, editKey);
    if (check === "not-found") {
      return errorResponse(404, "not-found", "This event doesn't exist or was deleted.");
    }
    if (check === "forbidden") {
      return errorResponse(403, "forbidden", "This edit link isn't valid for this event.");
    }

    const name = cleanText(displayName, EVENT_LIMITS.scorerName) || "Scorer";
    const session = liveblocks.prepareSession(participantId, { userInfo: { name } });
    session.allow(eventRoomIdForCode(code), ["room:write"]);
    const { status, body: authorized } = await session.authorize();
    return new NextResponse(authorized, {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return errorResponse(500, "server-error", "Events are unavailable right now.");
  }
}
