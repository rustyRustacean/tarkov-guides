import { normalizeSessionCode } from "@/features/maps/lib/session-code";

/** localStorage key: this browser's device-sync settings (role + code). */
export const DEVICE_SYNC_KEY = "tg.companion.devicesync";
/** localStorage key: a stable per-browser id, so the same device can re-host its own code. */
export const DEVICE_ID_KEY = "tg.companion.deviceid";

/**
 * The Liveblocks room backing a device-sync code. Namespaced `sync:` so it
 * can never collide with a collaborative map session (`maps:`): a shared
 * map code must not expose someone's personal progress.
 */
export function syncRoomIdForCode(code: string): string {
  return `sync:${normalizeSessionCode(code)}`;
}

export type DeviceSyncRole = "host" | "join";

export interface DeviceSyncSettings {
  /** `host` = this is the gaming PC publishing progress; `join` = a device mirroring it. */
  role: DeviceSyncRole;
  code: string;
}
