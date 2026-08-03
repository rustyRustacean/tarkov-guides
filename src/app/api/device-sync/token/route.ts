import { LiveblocksError } from "@liveblocks/node";
import { NextResponse } from "next/server";

import { syncRoomIdForCode } from "@/features/companion/device-sync-code";
import { isValidCustomCode } from "@/features/maps/lib/session-code";

import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../maps-session/rate-limit";

interface TokenRequestBody {
  mode: "host" | "join";
  code: string;
  deviceId: string;
}

function isTokenRequestBody(value: unknown): value is TokenRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    (body.mode === "host" || body.mode === "join") &&
    typeof body.code === "string" &&
    body.code.length > 0 &&
    typeof body.deviceId === "string" &&
    body.deviceId.length > 0
  );
}

function errorResponse(status: number, error: string, reason?: string): NextResponse {
  return NextResponse.json(reason !== undefined ? { error, reason } : { error }, { status });
}

function isNotFound(error: unknown): boolean {
  return error instanceof LiveblocksError && error.status === 404;
}

/**
 * Mints a room-scoped Liveblocks token for cross-device progress sync - the
 * "pair my phone/tablet with my gaming PC" feature in the companion panel.
 *
 * Deliberately a separate room namespace (`sync:`) from collaborative map
 * sessions (`maps:`), so a shared map code can never expose someone's personal
 * progress and vice versa. Same no-account model as map sessions: the code IS
 * the room id, so "does this code exist" is answered by asking Liveblocks
 * during this real, rate-limited attempt - never via a bare existence probe.
 *
 * `mode: "host"` is the gaming PC publishing its progress (creates the room if
 * new); `mode: "join"` is another device mirroring it (room must exist).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid-input", "Malformed request body.");
  }
  if (!isTokenRequestBody(body)) {
    return errorResponse(400, "invalid-input", "Missing or malformed fields.");
  }

  const { mode, code, deviceId } = body;

  const ip = clientIpFrom(request);
  const rateLimitOk =
    mode === "host"
      ? checkRateLimit(`sync-host:${ip}`, 20, 60_000)
      : checkRateLimit(`sync-join:${ip}`, 10, 60_000);
  if (!rateLimitOk) {
    return errorResponse(429, "rate-limited", "Too many attempts - try again shortly.");
  }

  const validation = isValidCustomCode(code);
  if (!validation.valid) {
    return errorResponse(400, "invalid-code", validation.reason);
  }

  const roomId = syncRoomIdForCode(code);

  try {
    const liveblocks = getLiveblocksServerClient();

    if (mode === "host") {
      try {
        const room = await liveblocks.getRoom(roomId);
        if (room.metadata.hostDeviceId !== deviceId) {
          return errorResponse(409, "code-taken", "That code is already in use - try another.");
        }
      } catch (error) {
        if (!isNotFound(error)) throw error;
        await liveblocks.createRoom(roomId, {
          defaultAccesses: [],
          metadata: { hostDeviceId: deviceId },
        });
        await liveblocks.mutateStorage(roomId, ({ root }) => {
          root.set("progress", null);
          root.set("updatedAt", 0);
        });
      }
    } else {
      try {
        await liveblocks.getRoom(roomId);
      } catch (error) {
        if (isNotFound(error)) {
          return errorResponse(404, "not-found", "No device found with that code.");
        }
        throw error;
      }
    }

    const session = liveblocks.prepareSession(deviceId, { userInfo: { name: "device" } });
    // Joining devices mirror the PC; only the host writes. Liveblocks' room
    // permissions are per-token, so a joiner gets read-only access.
    session.allow(roomId, mode === "host" ? ["room:write"] : ["room:read", "room:presence:write"]);
    const { status, body: authorizedBody } = await session.authorize();
    return new NextResponse(authorizedBody, {
      status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return errorResponse(500, "server-error", "Sync is unavailable right now.");
  }
}
