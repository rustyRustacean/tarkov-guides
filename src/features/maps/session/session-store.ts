import { create } from "zustand";

export type SessionRole = "host" | "guest";

export interface ActiveMapSession {
  code: string;
  roomId: string;
  role: SessionRole;
  displayName: string;
}

interface MapSessionState {
  activeSession: ActiveMapSession | null;
  setActiveSession: (session: ActiveMapSession) => void;
  clearActiveSession: () => void;
  /** Whether this browser follows the controller's pan/zoom while not driving. On by default; see `setFollowHostView`. */
  followHostView: boolean;
  setFollowHostView: (value: boolean) => void;
  restoreFollowHostView: () => void;
}

/**
 * Whether a collaborative map session is currently active, and if so, which
 * one and in what role. Deliberately its own tiny store, separate from
 * Liveblocks' reactive state (`liveblocks-config.ts`'s `useStorage`/
 * `useOthers`/etc.): it gates whether `MapSessionRoomProvider` connects to a
 * room, and lets session-unaware components (`MapPicker`,
 * `MapVariantSwitcher`) cheaply check "is a session active" without being
 * inside a Liveblocks room context. Everything reactive *inside* an active
 * session lives in Liveblocks' own hooks instead of being mirrored here, to
 * avoid a second, redundant source of truth.
 */
export const useMapSessionStore = create<MapSessionState>((set) => ({
  activeSession: null,
  setActiveSession(session) {
    set({ activeSession: session });
  },
  clearActiveSession() {
    set({ activeSession: null });
  },
  // Initialised to the default (not read from localStorage) so the client's
  // first render matches the server's and avoids a hydration mismatch. The
  // stored value is applied on mount via `restoreFollowHostView` (same
  // pattern as the maps store's `mapVariants`).
  followHostView: true,
  setFollowHostView(value) {
    set({ followHostView: value });
    writeFollowHostView(value);
  },
  restoreFollowHostView() {
    const stored = readFollowHostView();
    if (stored !== null) set({ followHostView: stored });
  },
}));

const FOLLOW_HOST_VIEW_STORAGE_KEY = "tarkovguides.session.followHostView";

/** The stored follow-the-controller preference, or `null` when never set / unreadable. */
function readFollowHostView(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FOLLOW_HOST_VIEW_STORAGE_KEY);
    return raw === null ? null : raw === "1";
  } catch {
    return null;
  }
}

function writeFollowHostView(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FOLLOW_HOST_VIEW_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Private-mode / disabled storage: the preference just doesn't persist.
  }
}

const PARTICIPANT_ID_STORAGE_KEY = "tarkovguides.session.participantId";

/**
 * This browser's stable session participant id, generated once and
 * persisted to localStorage so stroke authorship and `controllerId` survive
 * a reload/reconnect (unlike Liveblocks' own per-connection id, which
 * changes every time). Client-only (touches `localStorage`): only call this
 * from event handlers/effects, never at module load time.
 */
export function getParticipantId(): string {
  const existing = localStorage.getItem(PARTICIPANT_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PARTICIPANT_ID_STORAGE_KEY, id);
  return id;
}
