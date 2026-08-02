"use client";

import { useEffect, useRef } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useSyncMutation, useSyncStatus, useSyncStorage } from "./device-sync-config";
import { useDeviceSyncStore } from "./device-sync-store";

import type { ProfileProgress } from "@/features/progress-tracker/types";

/** Collapses a burst of edits (finishing a task cascades several) into one publish. */
const PUBLISH_DEBOUNCE_MS = 1500;
/** Time to stay connected after a publish so the write is definitely flushed. */
const FLUSH_GRACE_MS = 4000;

/**
 * Cross-device progress sync - **event-driven, not always-on**.
 *
 * - **host** (the gaming PC): stays disconnected while nothing happens. A real
 *   change - a task completing mid-raid, the companion syncing new quest state -
 *   opens the room just long enough to push it, then closes again. Leaving the
 *   tracker open on a second monitor for a 3-hour session costs seconds of
 *   connected time instead of 3 hours.
 * - **join** (phone/tablet/second PC): connects only while its tab is actually
 *   on screen, so a backgrounded phone costs nothing, and mirrors whatever the
 *   host last published as soon as you look at it.
 *
 * No-ops entirely while sync is off.
 */
export function useDeviceSync(): void {
  const settings = useDeviceSyncStore((state) => state.settings);
  const setLinkActive = useDeviceSyncStore((state) => state.setLinkActive);
  const role = settings?.role ?? null;
  const status = useSyncStatus();

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progressByProfile = useProgressTrackerStore((state) => state.progressByProfile);
  const replaceActiveProgress = useProgressTrackerStore((state) => state.replaceActiveProgress);

  const remote = useSyncStorage((root) => root.progress);
  const remoteUpdatedAt = useSyncStorage((root) => root.updatedAt);

  const publish = useSyncMutation(({ storage }, progress: ProfileProgress, at: number) => {
    storage.set("progress", progress as unknown as never);
    storage.set("updatedAt", at);
  }, []);

  // ---- host: open a short window whenever local progress actually changes ----
  const pendingRef = useRef<ProfileProgress | null>(null);
  const debounceRef = useRef<number | null>(null);
  const releaseRef = useRef<number | null>(null);
  const firstRunRef = useRef(true);

  const localProgress = activeProfileId !== null ? progressByProfile[activeProfileId] : undefined;

  useEffect(() => {
    if (role !== "host" || !localProgress) return;
    // Publish on the first paired render too, so a device that joins later sees
    // the current state rather than waiting for the next in-game event.
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => {
        pendingRef.current = localProgress;
        setLinkActive(true);
      },
      firstRunRef.current ? 0 : PUBLISH_DEBOUNCE_MS,
    );
    firstRunRef.current = false;
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [role, localProgress, setLinkActive]);

  // Flush the pending payload once the room is actually connected, then let go.
  useEffect(() => {
    if (role !== "host") return;
    if (status !== "connected" || pendingRef.current === null) return;
    publish(pendingRef.current, Date.now());
    pendingRef.current = null;
    if (releaseRef.current !== null) window.clearTimeout(releaseRef.current);
    releaseRef.current = window.setTimeout(() => {
      // Only disconnect if nothing new queued up while we were flushing.
      if (pendingRef.current === null) setLinkActive(false);
    }, FLUSH_GRACE_MS);
  }, [role, status, publish, setLinkActive]);

  // ---- join: connect only while this tab is on screen ----
  useEffect(() => {
    if (role !== "join") return;
    const sync = () => {
      setLinkActive(document.visibilityState === "visible");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      setLinkActive(false);
    };
  }, [role, setLinkActive]);

  // ---- join: mirror whatever the host published ----
  const appliedRef = useRef<number>(0);

  useEffect(() => {
    if (role !== "join" || activeProfileId === null) return;
    if (remote === null || remote === undefined) return;
    const stamp = typeof remoteUpdatedAt === "number" ? remoteUpdatedAt : 0;
    if (stamp === 0 || stamp === appliedRef.current) return;
    appliedRef.current = stamp;
    replaceActiveProgress(remote as unknown as ProfileProgress);
  }, [role, activeProfileId, remote, remoteUpdatedAt, replaceActiveProgress]);

  // Drop any window when sync is turned off entirely.
  useEffect(() => {
    if (settings === null) {
      pendingRef.current = null;
      firstRunRef.current = true;
      setLinkActive(false);
    }
  }, [settings, setLinkActive]);
}
