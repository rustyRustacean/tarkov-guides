"use client";

import { useEffect, useMemo, useRef } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import {
  existingModesForProfile,
  profileModeKey,
  PROFILE_MODES,
} from "@/features/progress-tracker/types";

import {
  COMPANION_PROFILE_MAP_KEY,
  COMPANION_PROFILE_SYNC_KEY,
  type CompanionFaction,
  type CompanionMode,
} from "./companion-config";
import { useBooleanPreference, useCompanionStatus, useEverConnected } from "./use-companion";

import type { ProfileFaction, ProfileMode } from "@/features/progress-tracker/types";

/** The subset of a tracker profile the sync decision needs: every mode-character it already has, and their factions. */
export interface SyncProfile {
  id: string;
  modes: ReadonlyMap<ProfileMode, ProfileFaction>;
}

export interface CompanionIdentity {
  profileId: string;
  mode: CompanionMode;
  faction: CompanionFaction | null;
}

export type ProfileSyncAction =
  | { kind: "none" }
  | { kind: "switch"; siteProfileId: string; mode: ProfileMode }
  | { kind: "adopt"; companionProfileId: string; siteProfileId: string; mode: ProfileMode }
  | {
      kind: "add-mode";
      companionProfileId: string;
      siteProfileId: string;
      mode: ProfileMode;
      faction: ProfileFaction;
    }
  | {
      kind: "create";
      companionProfileId: string;
      name: string;
      mode: ProfileMode;
      faction: ProfileFaction;
    };

/**
 * Both seasonal modes land in the one `PVP_SEASONAL` bucket, never in the
 * base-mode one. A seasonal character is a separate game profile with its own
 * quest state, so folding it into the player's real PvP/PvE progress would
 * corrupt the profile they actually care about; the tracker's seasonal mode
 * exists precisely to hold it (`ProfileMode`'s own doc comment: mechanically
 * "just another mode" with an independent progress bucket). `pve_season` has
 * no bucket of its own because the tracker models one seasonal mode, and the
 * label is generic ("Seasonal") - sharing it is still strictly better than
 * writing seasonal progress into a main-mode character.
 */
const MODE_TO_SITE: Record<CompanionMode, ProfileMode> = {
  pvp: "PVP",
  pve: "PVE",
  pvp_season: "PVP_SEASONAL",
  pve_season: "PVP_SEASONAL",
};
const MODE_LABEL: Record<ProfileMode, string> = { PVP: "PvP", PVE: "PvE", PVP_SEASONAL: "Season" };

/**
 * The tracker mode a companion mode syncs into. Shared with
 * `use-companion-task-sync.ts` so the two can never disagree about where a
 * given game character's progress belongs.
 */
export function companionModeToProfileMode(mode: CompanionMode): ProfileMode {
  return MODE_TO_SITE[mode];
}

/**
 * The companion→tracker link map's values used to be a bare tracker profile
 * id (one game character == one whole profile). Now that a profile can hold
 * up to 3 mode-characters, a link needs to name both the profile AND which
 * of its modes this particular game character maps to, stored as the same
 * `${profileId}:${mode}` composite key `progressByProfile` itself uses
 * (`profileModeKey`). An old-format value (no recognizable `:MODE` suffix)
 * simply fails to parse and is treated as "not linked" by every caller
 * below: this is low-stakes linking metadata (worst case: it re-links on
 * the next companion connect), not user progress data, so it doesn't need a
 * real migration, just graceful non-crashing fallback.
 */
function parseLinkedModeKey(value: string): { profileId: string; mode: ProfileMode } | null {
  for (const mode of PROFILE_MODES) {
    const suffix = `:${mode}`;
    if (value.endsWith(suffix) && value.length > suffix.length) {
      return { profileId: value.slice(0, -suffix.length), mode };
    }
  }
  return null;
}

/**
 * Decide how the tracker's active profile/mode should follow the game,
 * given the companion's current identity, the existing profiles (and each
 * one's already-set-up modes), and the saved game-id -> profile+mode link
 * map. Pure so it can be tested exhaustively.
 *
 * Priority:
 * (1) this game character is already linked to a specific profile+mode ->
 *     switch straight to it;
 * (2) otherwise, an existing profile that ALREADY has a same-mode bucket
 *     (matching faction, when the companion knows it) and isn't linked to a
 *     different game character -> adopt it (links this game id to that
 *     profile+mode, no new bucket); this is what stops an existing user's
 *     real "PvP" profile from being duplicated with a blank one;
 * (3) otherwise, an existing profile that does NOT have this mode yet and
 *     isn't already claimed -> add this mode to it as a new bucket. Prefers
 *     the currently-active profile when it qualifies (most likely to be the
 *     one the user wants this synced into), else the first eligible one: a
 *     genuine UX heuristic, not a mechanical port of prior behavior (there
 *     was no equivalent scenario before a profile could hold multiple
 *     modes), worth revisiting if it ever surprises a real user;
 * (4) only when nothing at all fits, create a fresh profile tagged by mode.
 */
export function decideProfileSync(
  companion: CompanionIdentity,
  profiles: readonly SyncProfile[],
  map: Readonly<Record<string, string>>,
  activeProfileId: string | null,
): ProfileSyncAction {
  const siteMode = MODE_TO_SITE[companion.mode];
  const { faction, profileId } = companion;

  const linkedRaw = map[profileId];
  const linked = linkedRaw !== undefined ? parseLinkedModeKey(linkedRaw) : null;
  if (linked && profiles.some((p) => p.id === linked.profileId && p.modes.has(linked.mode))) {
    return { kind: "switch", siteProfileId: linked.profileId, mode: linked.mode };
  }

  const takenSiteIds = new Set(
    Object.values(map)
      .map(parseLinkedModeKey)
      .filter((parsed): parsed is { profileId: string; mode: ProfileMode } => parsed !== null)
      .map((parsed) => parsed.profileId),
  );

  const adoptable = profiles.find((profile) => {
    const existingFaction = profile.modes.get(siteMode);
    return (
      existingFaction !== undefined &&
      (faction === null || existingFaction === faction) &&
      !takenSiteIds.has(profile.id)
    );
  });
  if (adoptable) {
    return {
      kind: "adopt",
      companionProfileId: profileId,
      siteProfileId: adoptable.id,
      mode: siteMode,
    };
  }

  const eligibleForNewMode = (profile: SyncProfile) =>
    !profile.modes.has(siteMode) && !takenSiteIds.has(profile.id);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const addModeTarget =
    activeProfile && eligibleForNewMode(activeProfile)
      ? activeProfile
      : profiles.find(eligibleForNewMode);
  if (addModeTarget) {
    return {
      kind: "add-mode",
      companionProfileId: profileId,
      siteProfileId: addModeTarget.id,
      mode: siteMode,
      // Faction is immutable once set; the companion resolves it from any raid,
      // so `null` is rare (menu-only history). Default to BEAR in that case.
      faction: faction ?? "BEAR",
    };
  }

  return {
    kind: "create",
    companionProfileId: profileId,
    name: MODE_LABEL[siteMode],
    mode: siteMode,
    faction: faction ?? "BEAR",
  };
}

/** Read the game-profile-id -> profile+mode link map from localStorage. */
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

/** Persist the game-profile-id -> profile+mode link map to localStorage. */
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
 * App-wide side effect: keep the tracker's active profile/mode in step with
 * the character the game is on. Acts once per distinct game profile id seen
 * (so it never fights a manual switch), applying {@link decideProfileSync}.
 *
 * Requires `everConnected` on top of the preference (which defaults on): this
 * runs unconditionally from `CompanionAutoLauncher` on every page, so without
 * that gate every first-time visitor's browser would poll `127.0.0.1` and hit
 * Chromium's "wants to access other apps and services on this device" prompt
 * before ever touching the companion feature, the same failure mode
 * `useCompanionPosition` is gated against.
 */
export function useCompanionProfileSync(): void {
  const [enabled] = useProfileSyncPreference();
  const [everConnected] = useEverConnected();
  const { status, isConnected } = useCompanionStatus(enabled && everConnected);
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const progressByProfile = useProgressTrackerStore((state) => state.progressByProfile);
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const createProfile = useProgressTrackerStore((state) => state.createProfile);
  const createProfileMode = useProgressTrackerStore((state) => state.createProfileMode);
  const switchProfile = useProgressTrackerStore((state) => state.switchProfile);
  const switchMode = useProgressTrackerStore((state) => state.switchMode);
  const handledRef = useRef<string | null>(null);

  const companionProfileId = status?.profileId ?? null;
  const companionMode = status?.mode ?? null;
  const companionFaction = status?.faction ?? null;

  // Memoized so this hook's effect (below) only re-evaluates when a profile
  // is actually added/removed or a mode-bucket actually appears/disappears.
  // `progressByProfile` changes on every single progress edit anywhere in
  // the app (stash counts, task status, ...), and recomputing a fresh
  // array+Maps on every one of those would otherwise re-trigger the effect
  // far more often than the sync decision could ever change.
  const syncProfiles: readonly SyncProfile[] = useMemo(
    () =>
      profiles.map((profile) => ({
        id: profile.id,
        modes: existingModesForProfile(progressByProfile, profile.id),
      })),
    [profiles, progressByProfile],
  );

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
      syncProfiles,
      map,
      activeProfileId,
    );

    if (action.kind === "switch") {
      if (activeProfileId !== action.siteProfileId) switchProfile(action.siteProfileId);
      switchMode(action.mode);
    } else if (action.kind === "adopt") {
      writeProfileMap({
        ...map,
        [action.companionProfileId]: profileModeKey(action.siteProfileId, action.mode),
      });
      if (activeProfileId !== action.siteProfileId) switchProfile(action.siteProfileId);
      switchMode(action.mode);
    } else if (action.kind === "add-mode") {
      createProfileMode({
        profileId: action.siteProfileId,
        mode: action.mode,
        faction: action.faction,
      });
      writeProfileMap({
        ...map,
        [action.companionProfileId]: profileModeKey(action.siteProfileId, action.mode),
      });
      if (activeProfileId !== action.siteProfileId) switchProfile(action.siteProfileId);
      switchMode(action.mode);
    } else if (action.kind === "create") {
      const newId = createProfile({
        name: action.name,
        mode: action.mode,
        faction: action.faction,
        face: null,
      });
      writeProfileMap({ ...map, [action.companionProfileId]: profileModeKey(newId, action.mode) });
    }

    handledRef.current = companionProfileId;
  }, [
    enabled,
    isConnected,
    companionProfileId,
    companionMode,
    companionFaction,
    syncProfiles,
    activeProfileId,
    createProfile,
    createProfileMode,
    switchProfile,
    switchMode,
  ]);
}
