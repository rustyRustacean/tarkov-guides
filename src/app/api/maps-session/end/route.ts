import { LiveblocksError } from "@liveblocks/node";
import { NextResponse } from "next/server";

import { roomIdForCode } from "@/features/maps/lib/session-code";

import { getLiveblocksServerClient } from "../lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../rate-limit";

interface EndRequestBody {
  code: string;
  participantId: string;
}

function isEndRequestBody(value: unknown): value is EndRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.code === "string" &&
    body.code.length > 0 &&
    typeof body.participantId === "string" &&
    body.participantId.length > 0
  );
}

function errorResponse(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Ends a collaborative map session, host-only. This is the real "code
 * expiry" the plan calls for - `liveblocks.deleteRoom` immediately makes the
 * code unjoinable, rather than relying solely on Liveblocks' own passive
 * inactivity cleanup as the only expiry mechanism.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid-input");
  }
  if (!isEndRequestBody(body)) {
    return errorResponse(400, "invalid-input");
  }

  if (!checkRateLimit(`end:${clientIpFrom(request)}`, 20, 60_000)) {
    return errorResponse(429, "rate-limited");
  }

  const roomId = roomIdForCode(body.code);

  try {
    const liveblocks = getLiveblocksServerClient();

    let room;
    try {
      room = await liveblocks.getRoom(roomId);
    } catch (error) {
      if (error instanceof LiveblocksError && error.status === 404) {
        // Already gone - ending an already-ended session is a no-op success,
        // not an error (avoids a confusing failure if two host tabs both hit "End").
        return NextResponse.json({ ok: true });
      }
      throw error;
    }

    if (room.metadata.hostParticipantId !== body.participantId) {
      return errorResponse(403, "forbidden");
    }

    await liveblocks.deleteRoom(roomId);
    return NextResponse.json({ ok: true });
  } catch {
    // See `token/route.ts`'s matching catch - most notably covers
    // `getLiveblocksServerClient()` throwing when `LIVEBLOCKS_SECRET_KEY`
    // isn't configured, so this never leaks an HTML error page instead of JSON.
    return errorResponse(500, "server-error");
  }
}
