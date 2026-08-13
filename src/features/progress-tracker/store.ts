import { create } from "zustand";

import { omitKey } from "@/shared/lib/record-utils";

import { emptyProfileProgress, profileModeKey } from "./types";

import type { ProgressTrackerSnapshot } from "./persistence/types";
import type {
  CustomItemEntry,
  HideoutBuiltKey,
  HideoutGoal,
  Profile,
  ProfileFaction,
  ProfileMode,
  ProfileModeKey,
  ProfileProgress,
  ProfileUpdate,
  TaskProgress,
} from "./types";

export interface ProgressTrackerState {
  profiles: readonly Profile[];
  activeProfileId: string | null;
  /** Site-wide, never null, defaults `"PVP"`. Independent axis from `activeProfileId`: switching mode never switches profile and vice versa. */
  activeMode: ProfileMode;
  progressByProfile: Readonly<Record<ProfileModeKey, ProfileProgress>>;
  /** Global pref (not per-profile), matches legacy's `state.autoStartNext`. */
  autoStartNext: boolean;
  /** Reserved for a future phone/desktop-companion live-sync feature; unused today, never read or written by anything currently in this app. */
  syncSource: "local" | null;
  lastSyncedAt: number | null;

  /**
   * Creates a profile identity and seeds its first mode-character. Makes
   * both the new profile and that mode the active selection. Returns the
   * new profile's id.
   *
   * Declared with arrow-function property syntax (`name: (args) => T`)
   * rather than TS method shorthand (`name(args): T`) throughout this
   * interface, matching the existing `shared/ui/toast/toast-store.ts`
   * convention. This avoids `@typescript-eslint/unbound-method` firing on
   * every call site that destructures an action off `useProgressTrackerStore()`
   * (the normal way to consume a Zustand store), since shorthand method
   * syntax carries an implicit, ambiguous `this`.
   */
  createProfile: (input: {
    name: string;
    mode: ProfileMode;
    faction: ProfileFaction;
    face: string | null;
  }) => string;
  /**
   * Adds a new mode-character to an EXISTING profile, e.g. setting up a
   * PvE character for a profile that so far only has PvP. No-op if the
   * profile doesn't exist, or already has a bucket for `mode` (faction is
   * immutable once a mode-bucket exists, same as profile creation).
   */
  createProfileMode: (input: {
    profileId: string;
    mode: ProfileMode;
    faction: ProfileFaction;
  }) => void;
  /** No-op if `id` doesn't match an existing profile. */
  switchProfile: (id: string) => void;
  /** Always succeeds: `ProfileMode` is a closed 3-value union, no validity gate needed. */
  switchMode: (mode: ProfileMode) => void;
  updateProfile: (id: string, patch: ProfileUpdate) => void;
  /** Removes the profile and every mode-bucket it had. If it was active, activates the first remaining profile, or `null` if none remain. */
  deleteProfile: (id: string) => void;
  setAutoStartNext: (on: boolean) => void;

  // Progress setters: thin, no cascade/business logic (that lives in
  // `lib/`/`selectors/`, called by hooks that then pass the already-computed
  // result here). Every one of these is a no-op if there's no active profile,
  // OR if the active profile has no bucket set up for the active mode yet.
  /** Merge-patches `taskStatus`; does not replace the whole record. */
  setTaskStatuses: (patch: Readonly<Record<string, TaskProgress>>) => void;
  /** Full replace of both `have` and `pending`, used by undo restore and raid-commit, both of which compute a whole new pair via `lib/item-tracking.ts`. */
  replaceHaveAndPending: (
    have: Readonly<Record<string, number>>,
    pending: Readonly<Record<string, number>>,
  ) => void;
  /** Expects an already-validated/clamped count; clamping lives in `lib/item-tracking.ts`'s `editStash`, called by the hook before this. */
  setHave: (itemId: string, count: number) => void;
  setPending: (itemId: string, count: number) => void;
  /** `undefined` entries delete that key (un-build); `true` entries set it (build). */
  setHideoutBuilt: (patch: Readonly<Record<HideoutBuiltKey, true | undefined>>) => void;
  /** Full replace of `hideoutBuilt`, used by the level-build toggle, whose cascade (`lib/hideout.ts`'s `toggleHideoutBuiltPatch`) computes a whole new record rather than a delta. */
  replaceHideoutBuilt: (hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>) => void;
  setHideoutGoal: (goal: HideoutGoal | null) => void;
  setKappaGot: (itemId: string, got: boolean) => void;
  setCustomItems: (items: readonly CustomItemEntry[]) => void;
  togglePinnedItem: (itemId: string) => void;
  togglePinnedTask: (taskId: string) => void;
  setPlayerLevel: (level: number) => void;
  setPrestigeLevel: (level: number) => void;
  setTraderLevel: (traderId: string, level: number) => void;
  setTraderReputation: (traderId: string, value: number) => void;

  /** Resets the active profile's progress to empty. The ONE place this happens, avoiding legacy's pattern of hand-duplicating "which fields count as progress" across multiple wipe/backup code paths. */
  wipeActiveProgress: () => void;
  /** Full replace of the active profile's entire progress bucket, used by undo restore and import. */
  replaceActiveProgress: (progress: ProfileProgress) => void;
  /** Full-state load from a persisted snapshot, called once on mount and by import/restore. */
  hydrate: (snapshot: ProgressTrackerSnapshot) => void;
}

export const useProgressTrackerStore = create<ProgressTrackerState>((set, get) => {
  /**
   * Applies `updater` to the active profile's active-mode progress bucket.
   * Hard no-op (not a create-on-demand fallback) if there's no active
   * profile, OR if that profile has no bucket for the active mode yet.
   * Bucket creation happens ONLY via `createProfile`/`createProfileMode`,
   * both of which require an explicit faction choice. A create-on-demand
   * fallback here would let a stray write (e.g. a companion-sync race)
   * silently fabricate a mode-bucket with a guessed faction.
   */
  function updateActiveProgress(updater: (progress: ProfileProgress) => ProfileProgress): void {
    const { activeProfileId, activeMode, progressByProfile } = get();
    if (activeProfileId === null) return;
    const key = profileModeKey(activeProfileId, activeMode);
    const current = progressByProfile[key];
    if (current === undefined) return;
    set({ progressByProfile: { ...progressByProfile, [key]: updater(current) } });
  }

  return {
    profiles: [],
    activeProfileId: null,
    activeMode: "PVP",
    progressByProfile: {},
    autoStartNext: true,
    syncSource: null,
    lastSyncedAt: null,

    createProfile(input) {
      const id = crypto.randomUUID();
      const profile: Profile = { id, name: input.name, face: input.face };
      const key = profileModeKey(id, input.mode);
      set((state) => ({
        profiles: [...state.profiles, profile],
        activeProfileId: id,
        activeMode: input.mode,
        progressByProfile: {
          ...state.progressByProfile,
          [key]: emptyProfileProgress(input.faction),
        },
      }));
      return id;
    },

    createProfileMode(input) {
      const { profiles, progressByProfile } = get();
      if (!profiles.some((profile) => profile.id === input.profileId)) return;
      const key = profileModeKey(input.profileId, input.mode);
      if (progressByProfile[key] !== undefined) return;
      set({
        progressByProfile: { ...progressByProfile, [key]: emptyProfileProgress(input.faction) },
      });
    },

    switchProfile(id) {
      const { profiles } = get();
      if (!profiles.some((profile) => profile.id === id)) return;
      set({ activeProfileId: id });
    },

    switchMode(mode) {
      set({ activeMode: mode });
    },

    updateProfile(id, patch) {
      set((state) => ({
        profiles: state.profiles.map((profile) =>
          profile.id === id ? { ...profile, ...patch } : profile,
        ),
      }));
    },

    deleteProfile(id) {
      set((state) => {
        const profiles = state.profiles.filter((profile) => profile.id !== id);
        const progressByProfile = Object.fromEntries(
          Object.entries(state.progressByProfile).filter(([key]) => !key.startsWith(`${id}:`)),
        ) as Record<ProfileModeKey, ProfileProgress>;
        const activeProfileId =
          state.activeProfileId === id ? (profiles[0]?.id ?? null) : state.activeProfileId;
        return { profiles, progressByProfile, activeProfileId };
      });
    },

    setAutoStartNext(on) {
      set({ autoStartNext: on });
    },

    setTaskStatuses(patch) {
      updateActiveProgress((progress) => ({
        ...progress,
        taskStatus: { ...progress.taskStatus, ...patch },
      }));
    },

    replaceHaveAndPending(have, pending) {
      updateActiveProgress((progress) => ({ ...progress, have, pending }));
    },

    setHave(itemId, count) {
      updateActiveProgress((progress) => ({
        ...progress,
        have: { ...progress.have, [itemId]: count },
      }));
    },

    setPending(itemId, count) {
      updateActiveProgress((progress) => ({
        ...progress,
        pending: { ...progress.pending, [itemId]: count },
      }));
    },

    setHideoutBuilt(patch) {
      updateActiveProgress((progress) => {
        let hideoutBuilt = progress.hideoutBuilt;
        for (const [key, value] of Object.entries(patch) as [HideoutBuiltKey, true | undefined][]) {
          hideoutBuilt =
            value === undefined ? omitKey(hideoutBuilt, key) : { ...hideoutBuilt, [key]: value };
        }
        return { ...progress, hideoutBuilt };
      });
    },

    setHideoutGoal(goal) {
      updateActiveProgress((progress) => ({ ...progress, hideoutGoal: goal }));
    },

    replaceHideoutBuilt(hideoutBuilt) {
      updateActiveProgress((progress) => ({ ...progress, hideoutBuilt }));
    },

    setKappaGot(itemId, got) {
      updateActiveProgress((progress) => ({
        ...progress,
        kappaGot: got
          ? { ...progress.kappaGot, [itemId]: true }
          : omitKey(progress.kappaGot, itemId),
      }));
    },

    setCustomItems(items) {
      updateActiveProgress((progress) => ({ ...progress, customItems: items }));
    },

    togglePinnedItem(itemId) {
      updateActiveProgress((progress) => ({
        ...progress,
        pinnedItemIds: progress.pinnedItemIds.includes(itemId)
          ? progress.pinnedItemIds.filter((id) => id !== itemId)
          : [itemId, ...progress.pinnedItemIds],
      }));
    },

    togglePinnedTask(taskId) {
      updateActiveProgress((progress) => ({
        ...progress,
        pinnedTaskIds: progress.pinnedTaskIds.includes(taskId)
          ? progress.pinnedTaskIds.filter((id) => id !== taskId)
          : [taskId, ...progress.pinnedTaskIds],
      }));
    },

    setPlayerLevel(level) {
      updateActiveProgress((progress) => ({ ...progress, playerLevel: level }));
    },

    setPrestigeLevel(level) {
      updateActiveProgress((progress) => ({ ...progress, prestigeLevel: level }));
    },

    setTraderLevel(traderId, level) {
      updateActiveProgress((progress) => ({
        ...progress,
        traderLevels: { ...progress.traderLevels, [traderId]: level },
      }));
    },

    setTraderReputation(traderId, value) {
      updateActiveProgress((progress) => ({
        ...progress,
        traderReputation: { ...progress.traderReputation, [traderId]: value },
      }));
    },

    wipeActiveProgress() {
      // Preserves the bucket's faction: wiping resets progress, not who this mode-character is.
      updateActiveProgress((progress) => emptyProfileProgress(progress.faction));
    },

    replaceActiveProgress(progress) {
      updateActiveProgress(() => progress);
    },

    hydrate(snapshot) {
      set({
        profiles: snapshot.profiles,
        activeProfileId: snapshot.activeProfileId,
        activeMode: snapshot.activeMode,
        progressByProfile: snapshot.progressByProfile,
        autoStartNext: snapshot.autoStartNext,
      });
    },
  };
});
