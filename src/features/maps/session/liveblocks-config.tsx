"use client";

import { createClient, LiveMap, LiveObject } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

import { getParticipantId, useMapSessionStore } from "./session-store";

import type { Json, Lson } from "@liveblocks/client";
import type { ReactNode } from "react";

/** Left minimal for v1 - no cursor sharing yet (a natural v1.1 follow-up). `isController` is derived from `Storage.controllerId`, not duplicated into Presence. */
export type SessionPresence = Record<string, never>;

/** Index signature required for `BaseUserMeta`'s `info: IUserInfo` constraint - see `SessionStorage`'s doc comment below on the resulting `useStorage` widening trade-off this forces (same idiom applies to presence/user-info reads via `useSelf`/`useOthers`, cast at their one call site in `use-maps-session.ts`). */
export interface SessionUserInfo {
  [key: string]: Json | undefined;
  name: string;
  color: string;
  isHost: boolean;
}

export interface SessionUserMeta {
  id: string;
  info: SessionUserInfo;
}

export interface SessionView {
  [key: string]: Json | undefined;
  mapNormalizedName: string;
  variantId: string;
  center: { lat: number; lng: number };
  zoom: number;
}

/**
 * One map+variant's shared drawing layer, keyed like `MapAnnotationLayer` but
 * as `LiveMap`s (keyed by each stroke/lock's own `id`) so concurrent adds
 * from different participants never conflict. Wrapped in a `LiveObject`
 * (rather than a bare `{strokes, locks}` shape) specifically so `strokes`/
 * `locks` are independently mutable substructures - a plain nested object
 * would instead be treated as one atomic JSON value, replaced wholesale on
 * every write and reintroducing the last-writer-wins conflict this LiveMap-
 * per-stroke design exists to avoid.
 *
 * Stroke/lock values are typed as `Json` here, not the app's own
 * `Stroke`/`LockRect` types - those are plain-data-compatible at runtime, but
 * as named interfaces (no index signature) they don't structurally satisfy
 * Liveblocks' `Lson` generic constraint, and adding an index signature to
 * them would leak a Liveblocks-specific concern into types used throughout
 * the whole Maps feature, not just this session. The real types are restored
 * via a cast at the one read/write boundary that touches them
 * (`use-session-annotation-layer.ts`), same idiom as `LiveObject`/`LiveMap`'s
 * own `Json`-typed generic defaults.
 *
 * The index signature below is required for `LiveObject<SessionAnnotationLayerStorage>`
 * to satisfy Liveblocks' own `O extends LsonObject` constraint wherever it's
 * referenced - unlike `Stroke`/`LockRect`, this interface is session-only, so
 * it doesn't leak elsewhere.
 */
export interface SessionAnnotationLayerStorage {
  [key: string]: Lson | undefined;
  strokes: LiveMap<string, Json>;
  locks: LiveMap<string, Json>;
}

/**
 * The index signature is required for `S extends LsonObject` (checked
 * wherever this is used as a Storage root type parameter). Trade-off worth
 * noting: it makes `ToJson<SessionStorage>` - the type `useStorage`'s
 * selectors receive - widen every named field into one broad `Json` union
 * instead of each field's own precise type (confirmed via a real type-check
 * regression while building this). `use-maps-session.ts` casts back to the
 * precise field types at its one `useStorage` call site, since this app
 * fully controls what's ever written to these fields - it's still real
 * plain-JSON data at runtime, just not something the type checker can see
 * through given this constraint.
 */
export interface SessionStorage {
  [key: string]: Lson | undefined;
  /** Immutable - set once at room creation (`api/maps-session/token/route.ts`). */
  hostId: string;
  /** Mutable - who currently drives the shared map view. Defaults to `hostId`. */
  controllerId: string;
  view: SessionView | null;
  /** Keyed by `${mapNormalizedName}:${variantId}`. */
  annotations: LiveMap<string, LiveObject<SessionAnnotationLayerStorage>>;
}

export type SessionRoomEvent =
  { type: "request-control" } | { type: "control-granted" } | { type: "control-denied" };

const client = createClient({
  authEndpoint: async (room) => {
    const activeSession = useMapSessionStore.getState().activeSession;
    if (!activeSession) {
      return { error: "forbidden", reason: "No active map session." };
    }
    const response = await fetch("/api/maps-session/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: activeSession.role === "host" ? "host" : "join",
        code: activeSession.code,
        participantId: getParticipantId(),
        displayName: activeSession.displayName,
      }),
    });
    const payload: unknown = await response.json();
    // `room` (the id Liveblocks itself is requesting a token for) should
    // always match `roomIdForCode(activeSession.code)` by construction - not
    // asserted here since a mismatch would just mean the token's permissions
    // don't cover this room, which Liveblocks itself already rejects.
    void room;
    return payload as { token: string } | { error: string; reason?: string };
  },
});

const roomContext = createRoomContext<
  SessionPresence,
  SessionStorage,
  SessionUserMeta,
  SessionRoomEvent
>(client);

export const {
  RoomProvider,
  useBroadcastEvent,
  useEventListener,
  useMutation,
  useOthers,
  useSelf,
  useStorage,
  useStatus,
} = roomContext;

/**
 * Always-mounted wrapper around `RoomProvider` - rather than mounting
 * `RoomProvider` conditionally on whether a session is active, this keeps it
 * permanently in the tree and toggles `autoConnect`/`id` instead. That way,
 * `useMapsSession` and every other Liveblocks hook this feature calls stay
 * legal to call unconditionally (React's rules of hooks forbid a component
 * from sometimes being inside a `RoomProvider` and sometimes not) - when
 * there's no active session, `id` is a stable placeholder and `autoConnect`
 * is `false`, so the hooks simply report "not connected" (`useSelf()` ->
 * `null`, `useStorage` -> `null`) instead of ever throwing.
 */
export function MapSessionRoomProvider({ children }: { children: ReactNode }) {
  const activeSession = useMapSessionStore((state) => state.activeSession);

  return (
    <RoomProvider
      id={activeSession?.roomId ?? "maps:inactive"}
      autoConnect={activeSession !== null}
      initialPresence={{}}
      initialStorage={() => ({
        hostId: "",
        controllerId: "",
        view: null,
        annotations: new LiveMap<string, LiveObject<SessionAnnotationLayerStorage>>(),
      })}
    >
      {children}
    </RoomProvider>
  );
}
