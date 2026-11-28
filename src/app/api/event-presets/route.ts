import { NextResponse } from "next/server";

import { asJson } from "@/features/events/room/event-storage";

import { createLockedRoom } from "../events/lib/event-keys";
import { cdnCacheHeaders, NO_STORE } from "../lib/cache-headers";
import { generateSecretKey, hashSecretKey } from "../lib/secrets";
import { getLiveblocksServerClient } from "../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom } from "../maps-session/rate-limit";

import {
  contentMetadata,
  failureResponse,
  listPublicPresets,
  preparePresetForPublishing,
  presetError,
  presetRoomId,
  readPresetBody,
  rejectionResponse,
} from "./lib/preset-rooms";

/**
 * The list's CDN lifetime, and its stale window. A new, hidden or deleted
 * preset shows within the sum (there's no purge), so it's kept short; each
 * refresh is at most 20 Liveblocks calls.
 */
const LIST_CACHE_HEADERS = cdnCacheHeaders(30, 30);

/**
 * The public library: every listed preset, most used first, then by name.
 * Built from room metadata alone (one paged query, no storage reads) and
 * cached at the CDN like the scoreboard snapshot, so the library's traffic
 * barely reaches Liveblocks.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!checkRateLimit(`preset-list:${clientIpFrom(request)}`, 60, 60_000)) {
    return presetError(429, "rate-limited", "Refreshing too often. Try again shortly.");
  }
  try {
    const presets = await listPublicPresets(getLiveblocksServerClient());
    return NextResponse.json({ presets }, { headers: LIST_CACHE_HEADERS });
  } catch (error) {
    return failureResponse(error);
  }
}

/**
 * Publishes a preset: the only way anything enters the library, and only
 * ever from an owner's explicit Publish. Validates and filters the preset
 * (`preparePresetForPublishing`), creates its locked room, and returns the
 * new id and a manage key. Like an event's edit key, the manage key is
 * returned once, here, and only its hash is kept.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIpFrom(request);
  // Two limits: attempts (so fixing a rejected name a few times doesn't lock
  // anyone out) and actual publishes (what fills the library).
  if (!checkRateLimit(`preset-publish-attempt:${ip}`, 30, 10 * 60_000)) {
    return presetError(429, "rate-limited", "Too many attempts. Try again in a few minutes.");
  }
  const body = await readPresetBody(request);
  if (body instanceof NextResponse) return body;

  // Checked with a placeholder id first, so nothing is created for a preset that fails.
  const checked = preparePresetForPublishing(body.preset, "pending");
  if (!checked.ok) return rejectionResponse(checked.rejection);
  if (!checkRateLimit(`preset-publish:${ip}`, 5, 60 * 60_000)) {
    return presetError(429, "rate-limited", "Too many presets published from here. Try later.");
  }

  try {
    const liveblocks = getLiveblocksServerClient();
    const manageKey = generateSecretKey();
    const now = new Date();
    const id = await createLockedRoom(liveblocks, presetRoomId, {
      kind: "preset",
      status: "listed",
      manageKeyHash: hashSecretKey(manageKey),
      uses: "0",
      publishedAt: now.toISOString(),
      ...contentMetadata(checked.preset, now),
    });
    if (id === null) return presetError(503, "server-error", "Couldn't publish. Try again.");

    try {
      await liveblocks.initializeStorageDocument(presetRoomId(id), {
        liveblocksType: "LiveObject",
        data: { version: 1, preset: asJson({ ...checked.preset, id }) },
      });
    } catch (error) {
      // Don't leave a listed room behind with no preset in it.
      await liveblocks.deleteRoom(presetRoomId(id)).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ id, manageKey }, { headers: NO_STORE });
  } catch (error) {
    return failureResponse(error);
  }
}
