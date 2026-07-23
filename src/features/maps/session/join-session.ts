"use client";

import { roomIdForCode } from "../lib/session-code";

import { getParticipantId, useMapSessionStore } from "./session-store";

export interface JoinSessionResult {
  ok: boolean;
  /** A short, user-facing reason - present whenever `ok` is `false`. */
  reason?: string;
}

/**
 * Shared submit logic for both the Host and Join forms
 * (`SessionEntryDialog.tsx`) - posts to the same `/api/maps-session/token`
 * route either way (only `mode` differs), and on success activates the
 * session locally (`useMapSessionStore`), which is what flips
 * `MapSessionRoomProvider`'s `autoConnect` on and lets Liveblocks' own
 * `authEndpoint` callback (`liveblocks-config.ts`) mint the real connection
 * token moments later. This call's own token (if any) is discarded - it
 * exists only to learn success/failure with a real error message before
 * committing to the session locally.
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
