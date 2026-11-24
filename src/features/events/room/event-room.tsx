"use client";

import { createClient, LiveList, LiveMap } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import { create } from "zustand";

import { eventRoomIdForCode } from "../lib/event-code";
import { getEventParticipantId } from "../lib/my-events-storage";

import type { EventStorage } from "./event-storage";
import type { ReactNode } from "react";

/** Editors share nothing live beyond their name (shown as "also scoring"). */
export type EventPresence = Record<string, never>;

/** What the token route attaches to each editor's connection. */
export interface EventUserMeta {
  id: string;
  info: { name: string };
}

/** Why the room refused this browser, when it did. */
export interface EventAuthProblem {
  kind: "forbidden" | "not-found" | "unavailable";
  reason: string;
}

/** The last time the token route refused this browser, readable inside React. Cleared on success. */
export const useEventAuthStore = create<{ problem: EventAuthProblem | null }>(() => ({
  problem: null,
}));

/**
 * The credentials each room's token request sends, keyed by room id.
 * Filled by {@link EventRoomProvider} as it renders, which is before the
 * room connects, and read by the auth callback, which Liveblocks hands the
 * room id it wants a token for. A plain map rather than React state: it's
 * only ever read outside React.
 */
const roomCredentials = new Map<string, { code: string; editKey: string; displayName: string }>();

const client = createClient({
  authEndpoint: async (room) => {
    const credentials = room ? roomCredentials.get(room) : undefined;
    if (!credentials) return { error: "forbidden", reason: "No edit key for this event." };
    let response: Response;
    try {
      response = await fetch("/api/events/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...credentials, participantId: getEventParticipantId() }),
      });
    } catch {
      useEventAuthStore.setState({
        problem: { kind: "unavailable", reason: "Couldn't reach the server." },
      });
      return { error: "unavailable", reason: "Couldn't reach the server." };
    }
    const payload = (await response.json()) as { token?: string; reason?: string };
    if (response.ok && payload.token) {
      useEventAuthStore.setState({ problem: null });
      return { token: payload.token };
    }
    const reason = payload.reason ?? "Couldn't open this event for editing.";
    const kind =
      response.status === 403 ? "forbidden" : response.status === 404 ? "not-found" : "unavailable";
    useEventAuthStore.setState({ problem: { kind, reason } });
    // "forbidden" stops Liveblocks from retrying: a wrong key won't become right.
    return { error: kind === "unavailable" ? "unavailable" : "forbidden", reason };
  },
});

const roomContext = createRoomContext<EventPresence, EventStorage, EventUserMeta>(client);

export const {
  RoomProvider: EventRoomContextProvider,
  useMutation: useEventMutation,
  useOthers: useEventOthers,
  useStatus: useEventStatus,
  useStorage: useEventStorage,
} = roomContext;

/**
 * Connects an editor to an event's room. Only mounted for someone holding
 * the edit key; viewers read the snapshot route instead and never connect.
 * The server seeds the room's storage when the event is created, so the
 * `initialStorage` below only applies to a room whose seeding failed, and
 * `parseEventDocument` then reports it as unusable instead of guessing.
 */
export function EventRoomProvider({
  code,
  editKey,
  displayName,
  children,
}: {
  code: string;
  editKey: string;
  displayName: string;
  children: ReactNode;
}) {
  // A changed display name applies from the next connection; the key and
  // code are fixed for this provider's room.
  roomCredentials.set(eventRoomIdForCode(code), { code, editKey, displayName });

  return (
    <EventRoomContextProvider
      id={eventRoomIdForCode(code)}
      initialPresence={{}}
      initialStorage={() => ({
        version: 0,
        settings: null,
        columns: [],
        teams: new LiveMap(),
        entries: new LiveMap(),
        adjustments: new LiveMap(),
        presets: new LiveMap(),
        activity: new LiveList([]),
      })}
    >
      {children}
    </EventRoomContextProvider>
  );
}
