import { NextResponse } from "next/server";

import { isPublicPresetId } from "@/features/events/lib/public-presets";

import { configuredSecret, hashSecretKey, secretKeyMatches } from "../../lib/secrets";
import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../maps-session/rate-limit";
import {
  failureResponse,
  getPresetRoom,
  listPresetRooms,
  notFound,
  presetError,
  presetIdFromRoomId,
  presetOk,
  presetRoomId,
  presetStatus,
  readPresetBody,
  readPublishedPreset,
  reporterHashes,
  summaryFields,
} from "../lib/preset-rooms";

import type { RoomData } from "@liveblocks/node";

/** Admin bodies are a key, an action and an id. */
const MAX_BODY_BYTES = 1_000;

/** A room's list fields plus how many distinct reporters it has (a count, never the hashes). */
function reviewEntry(room: RoomData, id: string) {
  return { ...summaryFields(room, id), reports: reporterHashes(room.metadata).length };
}

/**
 * Moderation for the public preset library, behind `EVENTS_ADMIN_KEY`.
 * The key is typed into the admin page and sent in the body, never in a
 * URL, and compared in constant time. Without a configured key (unset or
 * under 32 characters) every call is refused. A key that long can't be
 * guessed, so one per-IP limit (120 calls per 10 minutes, about 60 presets
 * reviewed) is enough.
 *
 * Actions: `list` the hidden presets (reported three times, or hidden by an
 * admin) with their report counts; `view` any preset's content to review
 * it; `hide` one; `restore` one (listed again, reports cleared); `delete`
 * one for good.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const adminKey = configuredSecret("EVENTS_ADMIN_KEY");
  if (!adminKey) return presetError(503, "unavailable", "Preset moderation isn't set up.");
  if (!checkRateLimit(`preset-admin:${clientIpFrom(request)}`, 120, 10 * 60_000)) {
    return presetError(429, "rate-limited", "Too many attempts. Try again in a few minutes.");
  }
  const body = await readPresetBody(request, MAX_BODY_BYTES);
  if (body instanceof NextResponse) return body;
  if (
    typeof body.adminKey !== "string" ||
    !secretKeyMatches(body.adminKey, hashSecretKey(adminKey))
  ) {
    return presetError(403, "forbidden", "That admin key isn't right.");
  }
  const { action, id } = body;

  try {
    const liveblocks = getLiveblocksServerClient();
    if (action === "list") {
      const rooms = await listPresetRooms(liveblocks, "hidden");
      const hidden = rooms.flatMap((room) => {
        const roomPresetId = presetIdFromRoomId(room.id);
        return roomPresetId ? [reviewEntry(room, roomPresetId)] : [];
      });
      return presetOk({ hidden });
    }

    if (!isPublicPresetId(id)) return presetError(400, "invalid-input", "Missing or malformed id.");
    if (action === "view") {
      const [room, preset] = await Promise.all([
        getPresetRoom(liveblocks, id),
        readPublishedPreset(liveblocks, id),
      ]);
      if (!room) return notFound();
      return presetOk({ ...reviewEntry(room, id), status: presetStatus(room.metadata), preset });
    }
    if (action !== "hide" && action !== "restore" && action !== "delete") {
      return presetError(400, "invalid-input", "Unknown action.");
    }

    if (!(await getPresetRoom(liveblocks, id))) return notFound();
    const roomId = presetRoomId(id);
    if (action === "delete") {
      await liveblocks.deleteRoom(roomId);
      return presetOk({ deleted: true });
    }
    const status = action === "hide" ? "hidden" : "listed";
    // Restoring also removes the reports (`null` deletes the key), so the count starts over.
    await liveblocks.updateRoom(roomId, {
      metadata: action === "hide" ? { status } : { status, reporters: null },
    });
    return presetOk({ status });
  } catch (error) {
    return failureResponse(error);
  }
}
