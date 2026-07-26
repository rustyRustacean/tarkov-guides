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
}

/**
 * Whether a collaborative map session is currently active, and if so, which
 * one and in what role. Deliberately its own tiny store, separate from
 * Liveblocks' own reactive state (`liveblocks-config.ts`'s `useStorage`/
 * `useOthers`/etc.) - this is what gates whether `MapSessionRoomProvider`
 * even connects to a room, and lets session-unaware components (`MapPicker`,
 * `MapVariantSwitcher`) cheaply check "is a session active" without needing
 * to be inside a Liveblocks room context. Everything reactive *inside* an
 * active session lives in Liveblocks' own hooks instead of being mirrored
 * here, to avoid a second, redundant source of truth.
 */
export const useMapSessionStore = create<MapSessionState>((set) => ({
  activeSession: null,
  setActiveSession(session) {
    set({ activeSession: session });
  },
  clearActiveSession() {
    set({ activeSession: null });
  },
}));

const PARTICIPANT_ID_STORAGE_KEY = "tarkovguides.session.participantId";

/**
 * This browser's stable session participant id - generated once and
 * persisted to localStorage, so stroke authorship and `controllerId` survive
 * a reload/reconnect (unlike Liveblocks' own per-connection id, which
 * changes every time). Client-only (touches `localStorage`) - only ever
 * called from event handlers/effects, never at module load time.
 */
export function getParticipantId(): string {
  const existing = localStorage.getItem(PARTICIPANT_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PARTICIPANT_ID_STORAGE_KEY, id);
  return id;
}
