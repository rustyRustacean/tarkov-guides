import { isPublicPresetId } from "@/features/events/lib/public-presets";

import { isSameOriginJsonRequest } from "../../../lib/same-origin";
import { configuredSecret, hmacHex } from "../../../lib/secrets";
import { getLiveblocksServerClient } from "../../../maps-session/lib/liveblocks-server";
import { checkRateLimit, clientIpFrom, knownClientIp } from "../../../maps-session/rate-limit";
import {
  failureResponse,
  getPresetRoom,
  notFound,
  presetError,
  presetOk,
  presetRoomId,
  presetStatus,
  reporterHashes,
  REPORTS_TO_HIDE,
} from "../../lib/preset-rooms";

import type { NextResponse } from "next/server";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * Reports a published preset. The third distinct reporter hides it from the
 * library until an admin restores or deletes it (`../../admin`).
 *
 * The one public write that needs no key, so:
 * - Same-origin JSON only (`isSameOriginJsonRequest`), so another site can't
 *   make its visitors report presets from many real IPs.
 * - Reporters are told apart by an HMAC of their IP under
 *   `EVENTS_REPORT_SECRET`, a secret Liveblocks never holds, so the room's
 *   metadata can't be turned back into IPs. Without that secret, reporting
 *   is off (503) rather than keyed with something guessable.
 * - The answer is the same whether or not anything changed, so reporting
 *   reveals nothing about the count.
 * - Reporters are only as distinct as their IPs: `clientIpFrom` trusts
 *   `X-Forwarded-For`, which Vercel sets itself; on any other host, the
 *   proxy in front must overwrite it, or one person could fake three.
 *
 * Accepted: two reports landing at the same moment can overwrite each
 * other's metadata write (no compare-and-set), losing one; that reporter
 * just counts later. And anyone with three IPs can hide a preset, which is
 * why hiding is reversible and never deletes anything.
 */
export async function POST(request: Request, ctx: Context): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!isSameOriginJsonRequest(request)) {
    return presetError(403, "forbidden", "Reports can only be sent from this site.");
  }
  const secret = configuredSecret("EVENTS_REPORT_SECRET");
  if (!secret) return presetError(503, "unavailable", "Reporting is unavailable right now.");
  if (!isPublicPresetId(id)) return notFound();
  if (!checkRateLimit(`preset-report:${clientIpFrom(request)}`, 10, 60 * 60_000)) {
    return presetError(429, "rate-limited", "Too many reports from here. Try again later.");
  }

  try {
    const liveblocks = getLiveblocksServerClient();
    const room = await getPresetRoom(liveblocks, id);
    // Hidden answers like missing, as the public GET does, so reporting can't tell them apart.
    if (!room || presetStatus(room.metadata) !== "listed") return notFound();
    const reporters = reporterHashes(room.metadata);
    const ip = knownClientIp(request);
    const reporter = ip === null ? null : hmacHex(secret, ip);
    // With no client IP every such request would share one hash, so it counts for nothing.
    if (reporter !== null && !reporters.includes(reporter)) {
      const next = [...reporters, reporter];
      await liveblocks.updateRoom(presetRoomId(id), {
        metadata: {
          reporters: next,
          ...(next.length >= REPORTS_TO_HIDE ? { status: "hidden" } : {}),
        },
      });
    }
    return presetOk({ reported: true });
  } catch (error) {
    return failureResponse(error);
  }
}
