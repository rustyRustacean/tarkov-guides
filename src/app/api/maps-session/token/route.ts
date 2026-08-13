import { LiveblocksError, LiveMap } from "@liveblocks/node";
import { NextResponse } from "next/server";

import { isValidCustomCode, roomIdForCode } from "@/features/maps/lib/session-code";
import { colorForParticipant } from "@/features/maps/lib/session-colors";

import { getLiveblocksServerClient } from "../lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../rate-limit";

const DISPLAY_NAME_MAX_LENGTH = 40;

interface TokenRequestBody {
  mode: "host" | "join";
  code: string;
  participantId: string;
  displayName: string;
}

function isTokenRequestBody(value: unknown): value is TokenRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    (body.mode === "host" || body.mode === "join") &&
    typeof body.code === "string" &&
    body.code.length > 0 &&
    typeof body.participantId === "string" &&
    body.participantId.length > 0 &&
    typeof body.displayName === "string" &&
    body.displayName.trim().length > 0
  );
}

function errorResponse(status: number, error: string, reason?: string): NextResponse {
  return NextResponse.json(reason !== undefined ? { error, reason } : { error }, { status });
}

function isNotFound(error: unknown): boolean {
  return error instanceof LiveblocksError && error.status === 404;
}

/**
 * Mints a room-scoped Liveblocks access token for a collaborative map
 * session, and for `mode: "host"` creates the room first if it doesn't exist
 * yet. The (normalized) `code` a user types/pastes IS the Liveblocks room id
 * (`roomIdForCode`); there's no database, so "does this code exist" is
 * answered by asking Liveblocks directly, never by a separate lookup the
 * client could probe on its own.
 *
 * This same route serves two callers: the Host/Join dialogs' explicit
 * button-press (to learn success/failure with a real error message), and
 * `@liveblocks/react`'s own `authEndpoint` callback on every (re)connect
 * (`session/liveblocks-config.ts`), which only ever looks at the `token`
 * field and ignores the rest, so one contract serves both.
 *
 * Security note: there is no account system in this app, so nothing here is
 * "authentication"; the goal is purely collision/guess resistance. The
 * client never gets a bare existence check; availability is only ever
 * revealed as a side effect of this real, rate-limited attempt, and nothing
 * anywhere lists active codes.
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

  const { mode, code, participantId, displayName } = body;
  const trimmedName = displayName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);

  const ip = clientIpFrom(request);
  const rateLimitOk =
    mode === "host"
      ? checkRateLimit(`host:${ip}`, 20, 60_000)
      : checkRateLimit(`join:${ip}`, 10, 60_000);
  if (!rateLimitOk) {
    return errorResponse(429, "rate-limited", "Too many attempts - try again shortly.");
  }

  const validation = isValidCustomCode(code);
  if (!validation.valid) {
    return errorResponse(400, "invalid-code", validation.reason);
  }

  const roomId = roomIdForCode(code);

  try {
    const liveblocks = getLiveblocksServerClient();

    let isHostConnection: boolean;

    if (mode === "host") {
      try {
        const room = await liveblocks.getRoom(roomId);
        if (room.metadata.hostParticipantId !== participantId) {
          return errorResponse(409, "code-taken", "That code is already in use - try another.");
        }
        isHostConnection = true; // the same host reconnecting (e.g. a second tab)
      } catch (error) {
        if (!isNotFound(error)) throw error;
        await liveblocks.createRoom(roomId, {
          defaultAccesses: [],
          metadata: { hostParticipantId: participantId },
        });
        await liveblocks.mutateStorage(roomId, ({ root }) => {
          root.set("hostId", participantId);
          root.set("controllerId", participantId);
          root.set("view", null);
          root.set("annotations", new LiveMap());
        });
        isHostConnection = true;
      }
    } else {
      try {
        const room = await liveblocks.getRoom(roomId);
        isHostConnection = room.metadata.hostParticipantId === participantId;
      } catch (error) {
        if (isNotFound(error)) {
          return errorResponse(404, "not-found", "No session found with that code.");
        }
        throw error;
      }
    }

    const session = liveblocks.prepareSession(participantId, {
      userInfo: {
        name: trimmedName,
        color: colorForParticipant(participantId),
        isHost: isHostConnection,
      },
    });
    session.allow(roomId, ["*:write"]);
    const { status, body: authorizedBody } = await session.authorize();
    return new NextResponse(authorizedBody, {
      status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    // Catches anything unexpected, most notably `getLiveblocksServerClient()`
    // throwing when `LIVEBLOCKS_SECRET_KEY` isn't configured. Without this,
    // such an error would propagate as an unhandled exception, returning an
    // HTML error page instead of the clean JSON error shape every caller
    // here expects.
    const message = error instanceof Error ? error.message : "Unknown error.";
    return errorResponse(500, "server-error", message);
  }
}
