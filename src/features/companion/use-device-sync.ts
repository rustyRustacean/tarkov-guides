"use client";

import { useEffect, useRef } from "react";

import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { localStorageAdapter } from "@/features/progress-tracker/persistence/local-storage-adapter";
import { setPersistenceSuspended } from "@/features/progress-tracker/persistence/suspend";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useSyncMutation, useSyncStatus, useSyncStorage } from "./device-sync-config";
import { useDeviceSyncStore } from "./device-sync-store";

import type { ProfileProgress } from "@/features/progress-tracker/types";

/** Collapses a burst of edits (finishing a task cascades several) into one publish. */
const PUBLISH_DEBOUNCE_MS = 1500;
/** Time to stay connected after a publish so the write is definitely flushed. */
const FLUSH_GRACE_MS = 4000;

/**
 * Cross-device progress sync: **event-driven, and read-only on the viewer**.
 *
 * - **host** (the gaming PC): stays disconnected while nothing happens. A
 *   real change (a task completing mid-raid, the companion syncing new
 *   quest state) opens the room just long enough to push it, then closes
 *   again, so leaving the tracker open for a 3-hour session costs seconds
 *   of connected time.
 * - **join** (phone/tablet/second PC): connects only while its tab is on
 *   screen and **only ever views** the host's progress. Persistence is
 *   suspended for the whole session, so this browser's own saved progress
 *   is never written over: localStorage keeps holding it untouched, and
 *   leaving the session simply re-reads it. A crash or closed tab mid-view
 *   is equally safe.
 *
 * No-ops entirely while sync is off.
 */
export function useDeviceSync(): void {
  const settings = useDeviceSyncStore((state) => state.settings);
  const setLinkActive = useDeviceSyncStore((state) => state.setLinkActive);
  const role = settings?.role ?? null;
  const status = useSyncStatus();

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const localProgress = useActiveProgress();
  const replaceActiveProgress = useProgressTrackerStore((state) => state.replaceActiveProgress);

  const remote = useSyncStorage((root) => root.progress);
  const remoteUpdatedAt = useSyncStorage((root) => root.updatedAt);
  // `useStorage` yields `null` until the room's storage has actually loaded:
  // publishing before that silently no-ops, which is why the first version
  // never wrote anything.
  const storageReady = remoteUpdatedAt !== null && remoteUpdatedAt !== undefined;

  const publish = useSyncMutation(({ storage }, progress: ProfileProgress, at: number) => {
    storage.set("progress", progress as unknown as never);
    storage.set("updatedAt", at);
  }, []);

  // ---- host: open a short window whenever local progress actually changes ----
  const pendingRef = useRef<ProfileProgress | null>(null);
  const debounceRef = useRef<number | null>(null);
  const releaseRef = useRef<number | null>(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (role !== "host" || !localProgress) return;
    // Publish on the first paired render too, so a device joining later sees
    // current state instead of waiting for the next in-game event.
    const delay = firstRunRef.current ? 0 : PUBLISH_DEBOUNCE_MS;
    firstRunRef.current = false;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      pendingRef.current = localProgress;
      setLinkActive(true);
    }, delay);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [role, localProgress, setLinkActive]);

  // Flush once the room is connected AND its storage has loaded, then let go.
  useEffect(() => {
    if (role !== "host") return;
    if (status !== "connected" || !storageReady) return;
    if (pendingRef.current === null) return;
    publish(pendingRef.current, Date.now());
    pendingRef.current = null;
    if (releaseRef.current !== null) window.clearTimeout(releaseRef.current);
    releaseRef.current = window.setTimeout(() => {
      if (pendingRef.current === null) setLinkActive(false);
    }, FLUSH_GRACE_MS);
  }, [role, status, storageReady, publish, setLinkActive]);

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

  // ---- join: view-only mode, suspend saving for the whole session ----
  const viewingRef = useRef(false);

  useEffect(() => {
    if (role !== "join") return;
    setPersistenceSuspended(true);
    viewingRef.current = true;
    return () => {
      // Leaving viewer mode (unpaired, role change, unmount): resume saving and
      // restore this browser's own progress straight from localStorage, which
      // was never overwritten while viewing.
      setPersistenceSuspended(false);
      viewingRef.current = false;
      void localStorageAdapter.read().then((snapshot) => {
        if (snapshot !== null) useProgressTrackerStore.getState().hydrate(snapshot);
      });
    };
  }, [role]);

  // ---- join: mirror whatever the host published (in memory only) ----
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
      appliedRef.current = 0;
      firstRunRef.current = true;
      setLinkActive(false);
    }
  }, [settings, setLinkActive]);
}
