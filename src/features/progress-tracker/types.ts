/**
 * Stored task status. "Locked"/"available" is never stored - it's always
 * derived (see `selectors/quest-availability.ts`), matching both legacy
 * apps' own vocabulary: neither ever persists a 4th status value, only
 * `notstarted`/`inprog`/`done`/`failed` (confirmed via
 * `old/TarkovTrackerWB-main/src/components/tasks/taskActions.js`).
 */
export type TaskStatus = "notstarted" | "inprog" | "done" | "failed";

export interface TaskProgress {
  status: TaskStatus;
  /** Set by the prerequisite auto-complete cascade rather than a direct user click - used for toast copy only, never read by status logic itself. */
  autoDone?: boolean;
  /** Set by the auto-start-unlocked-tasks cascade. */
  autoStarted?: boolean;
  /**
   * itemId → `have` count captured at the moment this task was marked done,
   * so undoing a "done" restores stash counts exactly. Ported from legacy's
   * `taskStatus[id].snap` (have-only - `pending` is deliberately untouched,
   * confirmed via `taskActions.js`'s `doneTask`/`undoTask`).
   */
  snapshot?: Readonly<Record<string, number>>;
  /**
   * ISO timestamp of the done/failed transition. Not present in either
   * legacy app - added so a real progress-over-time chart is possible later
   * without resorting to tarkov-tips's fake linear-interpolation one (see
   * `src/features/progress-tracker/README.md`'s deviations list). Optional
   * and absent for any pre-existing/imported data recorded before this field
   * existed.
   */
  completedAt?: string;
}

/** `${stationNormalizedName}:${level}` - a built hideout level. */
export type HideoutBuiltKey = `${string}:${number}`;

/** Builds a {@link HideoutBuiltKey} from a station's `normalizedName` and a level number. */
export function hideoutBuiltKey(stationNormalizedName: string, level: number): HideoutBuiltKey {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- interpolating a `number` here is required to satisfy the `HideoutBuiltKey` template-literal type; string concatenation would type as plain `string` instead.
  return `${stationNormalizedName}:${level}`;
}

export interface HideoutGoal {
  stationNormalizedName: string;
  level: number;
}

export interface CustomItemEntry {
  /**
   * The real tarkov.dev item id, resolved via a catalog search when the
   * player adds the item (never a synthetic id). This is deliberate: it lets
   * a custom-added item share the same `have`/`pending` stash row as the
   * same item required by a task, matching legacy's explicit intent
   * (`customItems.js`: "Share stash counts with real items ... so the +/-
   * buttons and editStash work as one unit").
   */
  id: string;
  name: string;
  iconLink: string | null;
  need: number;
}

/**
 * A game mode a profile can track progress in. `PVP_SEASONAL` added 2026-08
 * alongside the game's own seasonal-wipe PvP mode - mechanically it's "just
 * another mode" from this app's point of view (its own independent
 * progress bucket), even though tarkov.dev has no upstream data source for
 * it yet (see `getGameModeData` in `shared/lib/tarkov-api/types.ts`).
 */
export type ProfileMode = "PVP" | "PVE" | "PVP_SEASONAL";
export const PROFILE_MODES: readonly ProfileMode[] = ["PVP", "PVE", "PVP_SEASONAL"];
export const PROFILE_MODE_LABELS: Readonly<Record<ProfileMode, string>> = {
  PVP: "PvP",
  PVE: "PvE",
  PVP_SEASONAL: "Season",
};

export type ProfileFaction = "BEAR" | "USEC";

/**
 * `${profileId}:${mode}` - one mode-character's progress bucket. Mirrors
 * `HideoutBuiltKey`'s `${string}:${number}` composite-key convention.
 * A profile can hold up to 3 of these (one per `ProfileMode`), populated
 * lazily as the player actually sets each mode up - see `createProfileMode`
 * in `store.ts`.
 */
export type ProfileModeKey = `${string}:${ProfileMode}`;

/** Builds a {@link ProfileModeKey} from a profile id and mode. */
export function profileModeKey(profileId: string, mode: ProfileMode): ProfileModeKey {
  return `${profileId}:${mode}`;
}

/**
 * Everything that's per-character. Matches legacy's `PER_PROFILE_FIELDS`
 * list (`old/TarkovTrackerWB-main/src/components/profile/profile.js`) minus
 * map-annotation/map-display fields, which belong to Phase 5's Maps feature.
 *
 * `faction` lives here rather than on `Profile` (2026-08 game-mode rework) -
 * each mode is effectively its own in-game character, and can have its own
 * faction (e.g. BEAR in PvP, USEC in PvE for the same profile). Immutable
 * once a bucket exists, same convention as the old `Profile.faction`: no
 * setter is ever exposed for it.
 */
export interface ProfileProgress {
  faction: ProfileFaction;
  /** itemId → stash count. */
  have: Readonly<Record<string, number>>;
  /** itemId → this-raid uncommitted find count. */
  pending: Readonly<Record<string, number>>;
  /** taskId → progress. */
  taskStatus: Readonly<Record<string, TaskProgress>>;
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>;
  /** Per-profile - fixes a confirmed legacy bug where the goal was global despite depending entirely on per-profile `hideoutBuilt` state. */
  hideoutGoal: HideoutGoal | null;
  /**
   * itemId → got. A single shared Kappa/hideout stockpiling checklist -
   * sourced from either the task named "Collector" (see `lib/kappa.ts`'s
   * `getKappaItems`, matching confirmed legacy scoping - not every
   * `kappaRequired` task) or any not-yet-built hideout level (`getHideoutKappaItems`).
   * Deliberately one keyspace, not two: the same physical stash item can
   * satisfy both a hideout upgrade and the Collector task, so checking it
   * off in either tab marks it everywhere, matching this project's
   * established "everything keyed by real item id, one shared keyspace"
   * pattern (same reasoning as `CustomItemEntry.id`'s task-item stash merge).
   */
  kappaGot: Readonly<Record<string, true>>;
  customItems: readonly CustomItemEntry[];
  pinnedItemIds: readonly string[];
  pinnedTaskIds: readonly string[];
  /** Self-reported character level. Neither legacy app stores this per-profile (tarkov-tips used one ungoverned localStorage key); default `1`. */
  playerLevel: number;
  /**
   * Self-reported Prestige tier, default `0` (never prestiged). Gates tasks
   * like "New Beginning" (tarkov.dev's `requiredPrestige.prestigeLevel`) -
   * added 2026-07-16 task-data audit, confirmed via wiki cross-reference
   * that tarkov.dev's field means "must already have this Prestige level."
   */
  prestigeLevel: number;
  /** traderId → loyalty level. A missing entry is treated as level `1` by the availability selector. */
  traderLevels: Readonly<Record<string, number>>;
  /** traderId → reputation/standing value (e.g. Fence's scav karma). A missing entry is treated as `0`. */
  traderReputation: Readonly<Record<string, number>>;
}

/** A fresh, empty progress bucket for a newly-set-up mode-character. */
export function emptyProfileProgress(faction: ProfileFaction): ProfileProgress {
  return {
    faction,
    have: {},
    pending: {},
    taskStatus: {},
    hideoutBuilt: {},
    hideoutGoal: null,
    kappaGot: {},
    customItems: [],
    pinnedItemIds: [],
    pinnedTaskIds: [],
    playerLevel: 1,
    prestigeLevel: 0,
    traderLevels: {},
    traderReputation: {},
  };
}

/**
 * A bare character identity - name/face only. Deliberately mode-agnostic
 * (2026-08 game-mode rework): what used to be "the" mode and faction of a
 * profile are now per-mode-bucket fields on `ProfileProgress`, since one
 * profile can hold up to 3 independent mode-characters at once.
 */
export interface Profile {
  /** `crypto.randomUUID()` - fixes legacy's `'p' + Date.now()` collision risk (confirmed via `profile.js`). */
  id: string;
  name: string;
  /** A face/avatar id, or `null` for the default. Shared across every mode this profile has set up - purely cosmetic, no picker UI exists yet (always `null` today). */
  face: string | null;
}

export type ProfileUpdate = Partial<Pick<Profile, "name" | "face">>;

/**
 * Which of `PROFILE_MODES` a given profile already has a bucket for, and
 * that mode's faction. Used by the profile UI (per-mode badge summaries)
 * and the mode switcher (deciding whether clicking a mode should just
 * switch to it or first prompt to set it up).
 */
export function existingModesForProfile(
  progressByProfile: Readonly<Record<ProfileModeKey, ProfileProgress>>,
  profileId: string,
): ReadonlyMap<ProfileMode, ProfileFaction> {
  const result = new Map<ProfileMode, ProfileFaction>();
  for (const mode of PROFILE_MODES) {
    const bucket = progressByProfile[profileModeKey(profileId, mode)];
    if (bucket) result.set(mode, bucket.faction);
  }
  return result;
}
