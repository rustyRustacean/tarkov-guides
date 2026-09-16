"use client";

import { useEffect, useRef } from "react";

import { useCompanionPosition } from "@/features/companion/use-companion";

import { useOthers, useSelf, useUpdateMyPresence } from "./liveblocks-config";
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
 * A position's identity as a string: two positions with the same key are the
 * same capture and must not be republished. `at` alone would do it in
 * practice, but including the coordinates means a companion that ever reuses
 * a timestamp still can't swallow a real move.
 */
export function positionKey(
  position: Pick<SessionPlayerPosition, "x" | "z" | "yaw" | "map" | "at"> | null,
): string | null {
  if (!position) return null;
  return [position.x, position.z, position.yaw, position.map, position.at].join("|");
}

/**
 * Publishes this browser's own companion position into the session.
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
 * Mounted at the page level (`MapsPage`), NOT inside the marker layer. This
 * used to live in {@link useSessionPlayerPositions}, whose only caller was
 * `SessionPlayerMarkers` - a component that exists only while a
 * marker-accurate map variant is on screen. Whoever had an uncalibrated
 * variant open therefore silently stopped PUBLISHING while their own marker
 * (drawn locally by `PlayerMarker` straight off the companion) kept working -
 * the classic "I see him but he doesn't see me". Publishing must depend only
 * on being in a session, never on what the map screen happens to show.
 */
export function useSessionPositionPublisher(): void {
  const activeSession = useMapSessionStore((state) => state.activeSession);
  const updateMyPresence = useUpdateMyPresence();
  const position = useCompanionPosition();
  const publishedKeyRef = useRef<string | null>(null);
  const key = positionKey(position);

  useEffect(() => {
    if (!activeSession) {
      // Nothing is connected, so there's nobody to tell, but forget what was
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
}

/**
 * The local player's own session color, or undefined outside a session.
 *
 * Used by `PlayerMarker` so that IN a session your own chevron wears your
 * assigned participant color - the same one every teammate sees you as -
 * instead of the stylesheet's red accent. Without this, a two-person session
 * was a wall of red: your own marker is accent-red by default AND slot 0's
 * participant color is red, so on each player's screen every marker looked
 * identical ("the player colors are all red"). Outside a session `useSelf`
 * reports null (the room provider is mounted but not connected) and the
 * stylesheet accent applies as before.
 *
 * Lives here rather than in `PlayerMarker` so the component keeps zero direct
 * Liveblocks imports - its render tests mount it in a bare `MapContainer`
 * with this module mocked, exactly like `SessionPlayerMarkers`' tests.
 */
export function useOwnSessionColor(): string | undefined {
  const self = useSelf();
  const color: unknown = self?.info.color;
  return typeof color === "string" ? color : undefined;
}

/**
 * Everyone else's published positions, ready to draw. Read-only - publishing
 * this browser's own position is {@link useSessionPositionPublisher}'s job,
 * mounted once per page so it can't be taken down by the marker layer
 * unmounting (see its doc comment for the one-way-visibility bug that split
 * these two apart).
 *
 * Returns only *others* - the local player's own marker is already drawn by
 * `PlayerMarker` straight off the companion, without a round trip.
 */
export function useSessionPlayerPositions(): readonly SessionPlayerMarker[] {
  const others = useOthers();

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
