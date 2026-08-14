import { NextResponse } from "next/server";

import { findAccountId, type GameMode } from "@/features/player-lookup/player-index";

import { checkRateLimit, clientIpFrom } from "../maps-session/rate-limit";

/**
 * Resolve a player nickname to their tarkov.dev account id.
 *
 * `GET /api/player-lookup?name=<nickname>&mode=<pvp|pve>`
 *
 * Server-side because the nickname -> account id step needs tarkov.dev's
 * ~67 MB index (see `player-index.ts`). Keeping it here also means the
 * browser only ever talks to this origin, so no CSP `connect-src` change and
 * no third-party requests from the page. The id is all the caller needs: the
 * stats themselves are tarkov.dev's own page, opened by account id.
 */

function errorResponse(status: number, error: string, reason: string): NextResponse {
  return NextResponse.json({ error, reason }, { status });
}

/**
 * Answers 200 with `{found:false}` when the name simply isn't in tarkov.dev's
 * index - a miss is an ordinary result here, not an error, since the index
 * covers most players but not all.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") ?? "").trim();
  const modeParam = url.searchParams.get("mode");
  const mode: GameMode = modeParam === "pve" ? "pve" : "pvp";

  if (!name) return errorResponse(400, "invalid-input", "No name given.");
  if (name.length > 40) return errorResponse(400, "invalid-input", "That name is too long.");

  // Each lookup can trigger a 67 MB upstream download on a cold cache, so this
  // is rate limited more tightly than the session routes.
  if (!checkRateLimit(`player-lookup:${clientIpFrom(request)}`, 30, 60_000)) {
    return errorResponse(429, "rate-limited", "Too many lookups - try again shortly.");
  }

  try {
    const accountId = await findAccountId(name, mode);
    if (!accountId) {
      // A miss is a normal outcome, not a fault: tarkov.dev's index covers
      // 2.96M PvP accounts but not every player alive, and AI scav names are
      // never in it at all.
      return NextResponse.json(
        { found: false, nickname: name, mode, reason: "not-in-index" },
        { status: 200 },
      );
    }
    return NextResponse.json({ found: true, nickname: name, mode, accountId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return errorResponse(500, "server-error", message);
  }
}
