import { LiveblocksError, LiveList, LiveMap, type Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";

import { eventRoomIdForCode } from "@/features/events/lib/event-code";
import { parseEventDocument } from "@/features/events/lib/event-schema";
import { asJson } from "@/features/events/room/event-storage";

import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../maps-session/rate-limit";
import { generateEventCode, generateSecretKey, hashSecretKey } from "../lib/event-keys";

import type { EventDocument } from "@/features/events/types";

/** Imports can carry a whole finished event; anything past this isn't one. */
const MAX_BODY_BYTES = 1_000_000;

function errorResponse(status: number, error: string, reason: string): NextResponse {
  return NextResponse.json({ error, reason }, { status });
}

function isConflict(error: unknown): boolean {
  return error instanceof LiveblocksError && error.status === 409;
}

function toLiveMap<T extends Parameters<typeof asJson>[0]>(record: Record<string, T>) {
  return new LiveMap(Object.entries(record).map(([id, value]) => [id, asJson(value)] as const));
}

/** Writes a validated document into a freshly created, empty event room. */
function seedEventStorage(
  liveblocks: Liveblocks,
  roomId: string,
  document: EventDocument,
): Promise<void> {
  const created = { at: Date.now(), by: "TarkovGuides", summary: "Event created" };
  return liveblocks.mutateStorage(roomId, ({ root }) => {
    root.set("version", 1);
    root.set("settings", asJson(document.settings));
    root.set("columns", asJson(document.columns));
    root.set("teams", toLiveMap(document.teams));
    root.set("entries", toLiveMap(document.entries));
    root.set("adjustments", toLiveMap(document.adjustments));
    root.set("presets", toLiveMap(document.presets));
    root.set("activity", new LiveList([asJson(created)]));
  });
}

/**
 * Creates an event: validates the organizer's starting document (from the
 * create form, or an imported JSON export), then makes its Liveblocks room
 * and seeds the room's storage server side. The server picks the code and
 * the edit key, so a client can't choose a guessable one; only the key's
 * hash is kept (room metadata), and the key itself is returned once, here.
 *
 * The room is created with no default access: the only way in is a token
 * from `../token`, which needs the edit key. Viewers never connect at all,
 * they read `../[code]/snapshot`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIpFrom(request);
  if (!checkRateLimit(`event-create:${ip}`, 5, 10 * 60_000)) {
    return errorResponse(
      429,
      "rate-limited",
      "Too many new events from here. Try again in a few minutes.",
    );
  }

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return errorResponse(413, "too-large", "That event is too large to import.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid-input", "Malformed request body.");
  }
  const raw =
    typeof body === "object" && body !== null ? (body as { document?: unknown }).document : null;
  const document = parseEventDocument(raw);
  if (!document) {
    return errorResponse(
      400,
      "invalid-event",
      "The event needs a name and at least one game mode.",
    );
  }

  try {
    const liveblocks = getLiveblocksServerClient();
    const editKey = generateSecretKey();

    // A collision among ~8e14 codes is practically impossible, but retrying
    // costs nothing and keeps "create" from ever failing on one.
    let code: string | null = null;
    for (let attempt = 0; attempt < 3 && code === null; attempt++) {
      const candidate = generateEventCode();
      try {
        await liveblocks.createRoom(eventRoomIdForCode(candidate), {
          defaultAccesses: [],
          metadata: {
            kind: "event",
            editKeyHash: hashSecretKey(editKey),
            createdAt: new Date().toISOString(),
          },
        });
        code = candidate;
      } catch (error) {
        if (!isConflict(error)) throw error;
      }
    }
    if (code === null) {
      return errorResponse(503, "server-error", "Couldn't create the event. Try again.");
    }

    const roomId = eventRoomIdForCode(code);
    try {
      await seedEventStorage(liveblocks, roomId, document);
    } catch (error) {
      // Don't leave an empty room behind that no link can ever use.
      await liveblocks.deleteRoom(roomId).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ code, editKey }, { headers: { "cache-control": "no-store" } });
  } catch {
    return errorResponse(500, "server-error", "Events are unavailable right now.");
  }
}
