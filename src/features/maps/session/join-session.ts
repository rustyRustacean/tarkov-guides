"use client";

import { roomIdForCode } from "../lib/session-code";

import { getParticipantId, useMapSessionStore } from "./session-store";

export interface JoinSessionResult {
  ok: boolean;
  /** A short, user-facing reason. Present whenever `ok` is `false`. */
  reason?: string;
}

/**
 * Shared submit logic for the Host and Join forms (`SessionEntryDialog.tsx`).
 * Posts to `/api/maps-session/token` either way (only `mode` differs); on
 * success it activates the session locally (`useMapSessionStore`), which
 * flips `MapSessionRoomProvider`'s `autoConnect` on and lets Liveblocks'
 * `authEndpoint` callback (`liveblocks-config.ts`) mint the real connection
 * token moments later. This call's own token is discarded; it only exists to
 * surface a real error message before committing to the session locally.
 */
export async function submitSessionToken(
  mode: "host" | "join",
  code: string,
  displayName: string,
): Promise<JoinSessionResult> {
  let response: Response;
  try {
    response = await fetch("/api/maps-session/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        code,
        participantId: getParticipantId(),
        displayName,
      }),
    });
  } catch {
    return { ok: false, reason: "Couldn't reach the server - check your connection." };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "Unexpected server response." };
  }

  if (!response.ok) {
    const reason =
      typeof body === "object" && body !== null && "reason" in body
        ? String((body as { reason?: unknown }).reason)
        : "Something went wrong - try again.";
    return { ok: false, reason };
  }

  useMapSessionStore.getState().setActiveSession({
    code,
    roomId: roomIdForCode(code),
    role: mode === "host" ? "host" : "guest",
    displayName,
  });
  return { ok: true };
}
