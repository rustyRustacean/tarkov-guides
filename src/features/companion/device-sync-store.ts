"use client";

import { create } from "zustand";

import {
  DEVICE_ID_KEY,
  DEVICE_SYNC_KEY,
  type DeviceSyncRole,
  type DeviceSyncSettings,
} from "./device-sync-code";

/** A stable id for this browser, so the same PC can re-host its own code after a reload. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

function readSettings(): DeviceSyncSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_SYNC_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as Record<string, unknown>;
    if ((value.role !== "host" && value.role !== "join") || typeof value.code !== "string") {
      return null;
    }
    return { role: value.role, code: value.code };
  } catch {
    return null;
  }
}

function writeSettings(settings: DeviceSyncSettings | null): void {
  if (typeof window === "undefined") return;
  try {
    if (settings === null) window.localStorage.removeItem(DEVICE_SYNC_KEY);
    else window.localStorage.setItem(DEVICE_SYNC_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: sync just doesn't persist across reloads.
  }
}

interface DeviceSyncState {
  settings: DeviceSyncSettings | null;
  /** Set after a failed host/join attempt, for display in the panel. */
  error: string | null;
  /**
   * Whether the sync room should be connected *right now*.
   *
   * Sync is deliberately event-driven rather than a permanently-open
   * connection: the publishing PC connects only long enough to push a real
   * change (a task completing mid-raid), and a viewing device connects only
   * while its tab is actually on screen. Liveblocks bills connected time, so
   * an always-on link would burn a month's quota just by leaving the tracker
   * open on a second monitor during raids.
   */
  linkActive: boolean;
  /** Restores the saved pairing on mount (SSR-safe: initial state is always null). */
  restore: () => void;
  start: (role: DeviceSyncRole, code: string) => void;
  stop: () => void;
  setError: (error: string | null) => void;
  setLinkActive: (active: boolean) => void;
}

/**
 * Cross-device progress sync settings: whether this browser is the publishing
 * gaming PC (`host`) or a mirroring device (`join`), and the pairing code.
 * Initial state is always `null` so the client's first render matches SSR;
 * the saved pairing is restored in a mount effect (same pattern as the maps
 * store's session values).
 */
export const useDeviceSyncStore = create<DeviceSyncState>((set) => ({
  settings: null,
  error: null,
  linkActive: false,
  restore() {
    const saved = readSettings();
    if (saved) set({ settings: saved });
  },
  start(role, code) {
    const settings: DeviceSyncSettings = { role, code };
    writeSettings(settings);
    set({ settings, error: null });
  },
  stop() {
    writeSettings(null);
    set({ settings: null, error: null, linkActive: false });
  },
  setError(error) {
    set({ error });
  },
  setLinkActive(active) {
    set({ linkActive: active });
  },
}));
