"use client";

import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

import { syncRoomIdForCode } from "./device-sync-code";
import { getDeviceId, useDeviceSyncStore } from "./device-sync-store";

import type { Json, Lson } from "@liveblocks/client";
import type { ReactNode } from "react";

export type SyncPresence = Record<string, never>;

/**
 * The synced payload: the gaming PC's active-profile progress, stored as one
 * plain JSON value. It's replaced wholesale on every publish, so there's no
 * benefit to a `LiveMap` here, unlike map annotations: there are no
 * concurrent writers, only the host writes.
 */
export interface SyncStorage {
  [key: string]: Lson | undefined;
  progress: Json | null;
  updatedAt: number;
}

const client = createClient({
  authEndpoint: async (room) => {
    const settings = useDeviceSyncStore.getState().settings;
    if (!settings) return { error: "forbidden", reason: "Device sync is off." };
    const response = await fetch("/api/device-sync/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: settings.role,
        code: settings.code,
        deviceId: getDeviceId(),
      }),
    });
    void room;
    const payload: unknown = await response.json();
    return payload as { token: string } | { error: string; reason?: string };
  },
});

const roomContext = createRoomContext<SyncPresence, SyncStorage>(client);

export const {
  RoomProvider: SyncRoomProvider,
  useMutation: useSyncMutation,
  useStorage: useSyncStorage,
  useStatus: useSyncStatus,
} = roomContext;

/**
 * Always-mounted room wrapper. Like `MapSessionRoomProvider`, it stays in
 * the tree and toggles `autoConnect`/`id` instead of mounting
 * conditionally, so the sync hooks are always legal to call (React's rules
 * of hooks) and simply report "not connected" while sync is off.
 */
export function DeviceSyncRoomProvider({ children }: { children: ReactNode }) {
  const settings = useDeviceSyncStore((state) => state.settings);
  // Connect only during a real event window (see `linkActive`'s doc
  // comment): being paired is not by itself a reason to hold a connection
  // open.
  const linkActive = useDeviceSyncStore((state) => state.linkActive);

  return (
    <SyncRoomProvider
      // The room `id` must change to enter/leave a connection window:
      // toggling `autoConnect` alone leaves the client in its `initial`
      // state and it never dials out (same reason the maps session swaps to
      // a placeholder id when idle). Swapping to the placeholder here is
      // what actually closes the link between events.
      id={settings && linkActive ? syncRoomIdForCode(settings.code) : "sync:inactive"}
      autoConnect={settings !== null && linkActive}
      initialPresence={{}}
      initialStorage={() => ({ progress: null, updatedAt: 0 })}
    >
      {children}
    </SyncRoomProvider>
  );
}
