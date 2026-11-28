import { NextResponse } from "next/server";

import { isManageKey, isPublicPresetId } from "@/features/events/lib/public-presets";
import { asJson } from "@/features/events/room/event-storage";

import { isRoomNotFound } from "../../events/lib/event-keys";
import { cdnCacheHeaders, NO_STORE } from "../../lib/cache-headers";
import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../../maps-session/rate-limit";
import {
  contentMetadata,
  failureResponse,
  getPresetRoom,
  notFound,
  preparePresetForPublishing,
  presetError,
  presetRoomId,
  presetStatus,
  readPresetBody,
  readPublishedPreset,
  readSummary,
  rejectionResponse,
  verifyManageKey,
} from "../lib/preset-rooms";

import type { RoomData } from "@liveblocks/node";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * One preset's CDN lifetime, and its stale window. Hiding or unpublishing
 * can't purge it, so a hidden preset can stay visible here for up to the
 * sum. Adopting into an event reads Liveblocks directly, so a hidden preset
 * can never be adopted.
 */
const PUBLIC_CACHE_HEADERS = cdnCacheHeaders(15, 15);

function deleted(): NextResponse {
  return NextResponse.json({ deleted: true }, { headers: NO_STORE });
}

/**
 * Reads `{ manageKey, ...rest }` for the owner's routes and checks the key
 * against the room: the body and room, or the error response to send.
 */
async function authorizeOwner(
  request: Request,
  id: string,
  rateKey: string,
): Promise<NextResponse | { body: Record<string, unknown>; room: RoomData }> {
  if (!checkRateLimit(`${rateKey}:${clientIpFrom(request)}`, 20, 60_000)) {
    return presetError(429, "rate-limited", "Too many attempts. Try again shortly.");
  }
  const body = await readPresetBody(request);
  if (body instanceof NextResponse) return body;
  if (!isPublicPresetId(id) || !isManageKey(body.manageKey)) {
    return presetError(400, "invalid-input", "Missing or malformed fields.");
  }
  const check = await verifyManageKey(getLiveblocksServerClient(), id, body.manageKey);
  if (check.result === "not-found") return notFound();
  if (check.result === "forbidden") {
    return presetError(403, "forbidden", "This manage link isn't valid for this preset.");
  }
  return { body, room: check.room };
}

/**
 * One listed preset, for its public page. Hidden presets (reported, waiting
 * for review) are a 404 here; their owner reads them through POST with the
 * manage key. Cached at the CDN by URL alone, so this response must never
 * depend on who's asking.
 */
export async function GET(request: Request, ctx: Context): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!isPublicPresetId(id)) return notFound();
  if (!checkRateLimit(`preset-read:${clientIpFrom(request)}`, 120, 60_000)) {
    return presetError(429, "rate-limited", "Refreshing too often. Try again shortly.");
  }
  try {
    const liveblocks = getLiveblocksServerClient();
    // Both reads need only the id, so they run together; the status decides afterwards.
    const [room, preset] = await Promise.all([
      getPresetRoom(liveblocks, id),
      readPublishedPreset(liveblocks, id),
    ]);
    const summary = room ? readSummary(room) : null;
    if (!room || !summary || !preset || presetStatus(room.metadata) !== "listed") {
      return notFound();
    }
    return NextResponse.json({ preset, summary }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    return failureResponse(error);
  }
}

/** The owner's view: the preset and its status, hidden or not. Needs the manage key. */
export async function POST(request: Request, ctx: Context): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const owner = await authorizeOwner(request, id, "preset-owner");
    if (owner instanceof NextResponse) return owner;
    const preset = await readPublishedPreset(getLiveblocksServerClient(), id);
    if (!preset) return notFound();
    return NextResponse.json(
      { preset, summary: readSummary(owner.room), status: presetStatus(owner.room.metadata) },
      { headers: NO_STORE },
    );
  } catch (error) {
    return failureResponse(error);
  }
}

/**
 * Replaces a published preset's content. Needs the manage key, and goes
 * through the same validation and filter as publishing. The status is left
 * alone: editing a hidden preset doesn't relist it, only an admin does.
 */
export async function PUT(request: Request, ctx: Context): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const owner = await authorizeOwner(request, id, "preset-update");
    if (owner instanceof NextResponse) return owner;
    const checked = preparePresetForPublishing(owner.body.preset, id);
    if (!checked.ok) return rejectionResponse(checked.rejection);
    const liveblocks = getLiveblocksServerClient();
    // Two writes Liveblocks can't make atomic. If one fails the owner sees an
    // error and saves again, which brings the list's name back in line.
    await Promise.all([
      liveblocks.mutateStorage(presetRoomId(id), ({ root }) => {
        root.set("preset", asJson(checked.preset));
      }),
      liveblocks.updateRoom(presetRoomId(id), {
        metadata: contentMetadata(checked.preset, new Date()),
      }),
    ]);
    return NextResponse.json({ preset: checked.preset }, { headers: NO_STORE });
  } catch (error) {
    return failureResponse(error);
  }
}

/** Unpublishes: deletes the preset's room. Events that already adopted it keep their own copy. */
export async function DELETE(request: Request, ctx: Context): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const owner = await authorizeOwner(request, id, "preset-delete");
    // Already gone counts as done, so a repeated unpublish succeeds.
    if (owner instanceof NextResponse) return owner.status === 404 ? deleted() : owner;
    await getLiveblocksServerClient().deleteRoom(presetRoomId(id));
    return deleted();
  } catch (error) {
    return isRoomNotFound(error) ? deleted() : failureResponse(error);
  }
}
