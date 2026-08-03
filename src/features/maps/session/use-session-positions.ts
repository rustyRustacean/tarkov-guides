"use client";

import { useEffect, useRef } from "react";

import { useCompanionPosition } from "@/features/companion/use-companion";

import { useOthers, useUpdateMyPresence } from "./liveblocks-config";
import { useMapSessionStore } from "./session-store";

import type { SessionPlayerPosition } from "./liveblocks-config";

/** One teammate's live position, ready to draw: their identity plus where they are. */
export interface SessionPlayerMarker {
  id: string;
  name: string;
  color: string;
  position: SessionPlayerPosition;
}

/**
 * A position's identity as a string - two positions with the same key are the
 * same capture and must not be republished. `at` alone would do it in
 * practice, but including the coordinates means a companion that ever reuses a
 * timestamp still can't swallow a real move.
 */
export function positionKey(
  position: Pick<SessionPlayerPosition, "x" | "z" | "yaw" | "map" | "at"> | null,
): string | null {
  if (!position) return null;
  return [position.x, position.z, position.yaw, position.map, position.at].join("|");
}

/**
 * Publishes this browser's own companion position into the session, and reads
 * back everyone else's.
 *
 * Positions travel over Presence (see `SessionPresence`), so they're inherently
 * ephemeral: a teammate who disconnects stops being drawn, no cleanup needed.
 *
 * Publishing is deduped on {@link positionKey} rather than fired on every
 * value: `useCompanionPosition` is a 5-second poll that hands back a freshly
 * parsed object each time, so writing it through unconditionally would push a
 * presence update every poll for a position that hasn't moved. The companion
 * only produces a new position when the player takes an in-raid screenshot, so
 * genuinely new values are rare and each one matters.
 *
 * Returns only *others* - the local player's own marker is already drawn by
 * `PlayerMarker` straight off the companion, without a round trip.
 */
export function useSessionPlayerPositions(): readonly SessionPlayerMarker[] {
  const activeSession = useMapSessionStore((state) => state.activeSession);
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();
  const position = useCompanionPosition();
  const publishedKeyRef = useRef<string | null>(null);
  const key = positionKey(position);

  useEffect(() => {
    if (!activeSession) {
      // Nothing is connected, so there's nobody to tell - but forget what was
      // published so joining a room later re-sends the current position
      // instead of assuming the new room already has it.
      publishedKeyRef.current = null;
      return;
    }
    if (publishedKeyRef.current === key) return;
    publishedKeyRef.current = key;
    updateMyPresence({
      position: position
        ? { x: position.x, z: position.z, yaw: position.yaw, map: position.map, at: position.at }
        : null,
    });
  }, [activeSession, key, position, updateMyPresence]);

  return others.flatMap((other) => {
    const theirPosition = other.presence.position;
    if (!theirPosition) return [];
    return [
      {
        id: other.id,
        name: other.info.name,
        color: other.info.color,
        position: theirPosition,
      },
    ];
  });
}
