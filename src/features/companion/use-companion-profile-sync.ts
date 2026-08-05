"use client";

import { useEffect, useRef } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import {
  COMPANION_PROFILE_MAP_KEY,
  COMPANION_PROFILE_SYNC_KEY,
  type CompanionFaction,
  type CompanionMode,
} from "./companion-config";
import { useBooleanPreference, useCompanionStatus, useEverConnected } from "./use-companion";

import type { ProfileFaction, ProfileMode } from "@/features/progress-tracker/types";

/** The subset of a tracker profile the sync decision needs. */
export interface SyncProfile {
  id: string;
  mode: ProfileMode;
  faction: ProfileFaction;
}

export interface CompanionIdentity {
  profileId: string;
  mode: CompanionMode;
  faction: CompanionFaction | null;
}

export type ProfileSyncAction =
  | { kind: "none" }
  | { kind: "switch"; siteProfileId: string }
  | { kind: "adopt"; companionProfileId: string; siteProfileId: string }
  | {
      kind: "create";
      companionProfileId: string;
      name: string;
      mode: ProfileMode;
      faction: ProfileFaction;
    };

const MODE_TO_SITE: Record<CompanionMode, ProfileMode> = { pvp: "PVP", pve: "PVE" };
const MODE_LABEL: Record<ProfileMode, string> = { PVP: "PvP", PVE: "PvE" };

/**
 * Decide how the tracker's active profile should follow the game, given the
 * companion's current identity, the existing profiles, and the saved
 * game-id -> tracker-id map. Pure so it can be tested exhaustively.
 *
 * Priority: (1) a profile already linked to this game id -> switch to it;
 * (2) otherwise adopt an existing same-mode (and, when known, same-faction)
 * profile that isn't linked to a different game id - this is what stops an
 * existing user's real "PvP" profile from being duplicated with a blank one;
 * (3) only when nothing fits, create a fresh profile tagged by mode.
 */
export function decideProfileSync(
  companion: CompanionIdentity,
  profiles: readonly SyncProfile[],
  map: Readonly<Record<string, string>>,
): ProfileSyncAction {
  const siteMode = MODE_TO_SITE[companion.mode];
  const { faction, profileId } = companion;

  const linkedId = map[profileId];
  if (linkedId !== undefined && profiles.some((profile) => profile.id === linkedId)) {
    return { kind: "switch", siteProfileId: linkedId };
  }

  const takenSiteIds = new Set(Object.values(map));
  const adoptable = profiles.find(
    (profile) =>
      profile.mode === siteMode &&
      (faction === null || profile.faction === faction) &&
      !takenSiteIds.has(profile.id),
  );
  if (adoptable) {
    return { kind: "adopt", companionProfileId: profileId, siteProfileId: adoptable.id };
  }

  return {
    kind: "create",
    companionProfileId: profileId,
    name: MODE_LABEL[siteMode],
    mode: siteMode,
    // Faction is immutable once set; the companion resolves it from any raid,
    // so `null` is rare (menu-only history). Default to BEAR in that case.
    faction: faction ?? "BEAR",
  };
}

/** Read the game-profile-id -> tracker-profile-id link map from localStorage. */
export function readProfileMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COMPANION_PROFILE_MAP_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist the game-profile-id -> tracker-profile-id link map to localStorage. */
export function writeProfileMap(map: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPANION_PROFILE_MAP_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable: the link simply doesn't persist across reloads.
  }
}

/** Auto profile-sync preference (default on). */
export function useProfileSyncPreference(): [boolean, (value: boolean) => void] {
  return useBooleanPreference(COMPANION_PROFILE_SYNC_KEY, true);
}

/**
 * App-wide side effect: keep the tracker's active profile in step with the
 * character the game is on. Acts once per distinct game profile id seen (so it
 * never fights a manual switch), applying {@link decideProfileSync}.
 *
 * Requires `everConnected` on top of the preference (which defaults on): this
 * runs unconditionally from `CompanionAutoLauncher` on every page, so without
 * that gate every first-time visitor's browser would poll `127.0.0.1` and hit
 * Chromium's "wants to access other apps and services on this device" prompt
 * before ever touching the companion feature - the same failure mode
 * `useCompanionPosition` is gated against.
 */
export function useCompanionProfileSync(): void {
  const [enabled] = useProfileSyncPreference();
  const [everConnected] = useEverConnected();
  const { status, isConnected } = useCompanionStatus(enabled && everConnected);
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const createProfile = useProgressTrackerStore((state) => state.createProfile);
  const switchProfile = useProgressTrackerStore((state) => state.switchProfile);
  const handledRef = useRef<string | null>(null);

  const companionProfileId = status?.profileId ?? null;
  const companionMode = status?.mode ?? null;
  const companionFaction = status?.faction ?? null;

  useEffect(() => {
    if (!enabled) {
      handledRef.current = null;
      return;
    }
    if (!isConnected || companionProfileId === null || companionMode === null) return;
    if (handledRef.current === companionProfileId) return;

    const map = readProfileMap();
    const action = decideProfileSync(
      { profileId: companionProfileId, mode: companionMode, faction: companionFaction },
      profiles,
      map,
    );

    if (action.kind === "switch") {
      if (activeProfileId !== action.siteProfileId) switchProfile(action.siteProfileId);
    } else if (action.kind === "adopt") {
      writeProfileMap({ ...map, [action.companionProfileId]: action.siteProfileId });
      if (activeProfileId !== action.siteProfileId) switchProfile(action.siteProfileId);
    } else if (action.kind === "create") {
      const newId = createProfile({
        name: action.name,
        mode: action.mode,
        faction: action.faction,
        face: null,
      });
      writeProfileMap({ ...map, [action.companionProfileId]: newId });
    }

    handledRef.current = companionProfileId;
  }, [
    enabled,
    isConnected,
    companionProfileId,
    companionMode,
    companionFaction,
    profiles,
    activeProfileId,
    createProfile,
    switchProfile,
  ]);
}
