import { PROFILE_MODES } from "../types";

import type { ProgressTrackerSnapshot } from "./types";
import type {
  CustomItemEntry,
  HideoutGoal,
  Profile,
  ProfileMode,
  ProfileModeKey,
  ProfileProgress,
  TaskProgress,
  TaskStatus,
} from "../types";

interface SerializableState {
  profiles: readonly Profile[];
  activeProfileId: string | null;
  activeMode: ProfileMode;
  progressByProfile: Readonly<Record<ProfileModeKey, ProfileProgress>>;
  autoStartNext: boolean;
}

/** The one canonical serializer - every persistence backend (localStorage, FSA folder, manual export) calls this, never hand-builds its own payload shape. */
export function serializeSnapshot(state: SerializableState): ProgressTrackerSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    activeMode: state.activeMode,
    progressByProfile: state.progressByProfile,
    autoStartNext: state.autoStartNext,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "number");
}

function isTrueRecord(value: unknown): value is Record<string, true> {
  return isRecord(value) && Object.values(value).every((entry) => entry === true);
}

function isValidTaskStatus(value: unknown): value is TaskStatus {
  return value === "notstarted" || value === "inprog" || value === "done" || value === "failed";
}

function isValidProfileMode(value: unknown): value is ProfileMode {
  return value === "PVP" || value === "PVE" || value === "PVP_SEASONAL";
}

function isValidTaskProgress(value: unknown): value is TaskProgress {
  if (!isRecord(value)) return false;
  if (!isValidTaskStatus(value.status)) return false;
  if (value.autoDone !== undefined && typeof value.autoDone !== "boolean") return false;
  if (value.autoStarted !== undefined && typeof value.autoStarted !== "boolean") return false;
  if (value.snapshot !== undefined && !isNumberRecord(value.snapshot)) return false;
  if (value.completedAt !== undefined && typeof value.completedAt !== "string") return false;
  return true;
}

function toValidTaskStatusRecord(value: unknown): Record<string, TaskProgress> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, TaskProgress> = {};
  for (const [taskId, entry] of Object.entries(value)) {
    if (!isValidTaskProgress(entry)) return null;
    result[taskId] = entry;
  }
  return result;
}

function isValidHideoutGoal(value: unknown): value is HideoutGoal | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return typeof value.stationNormalizedName === "string" && typeof value.level === "number";
}

function isValidCustomItemEntry(value: unknown): value is CustomItemEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.iconLink === null || typeof value.iconLink === "string") &&
    typeof value.need === "number"
  );
}

function isValidProfileProgress(value: unknown): value is ProfileProgress {
  if (!isRecord(value)) return false;
  const taskStatus = toValidTaskStatusRecord(value.taskStatus);
  return (
    (value.faction === "BEAR" || value.faction === "USEC") &&
    isNumberRecord(value.have) &&
    isNumberRecord(value.pending) &&
    taskStatus !== null &&
    isTrueRecord(value.hideoutBuilt) &&
    isValidHideoutGoal(value.hideoutGoal) &&
    isTrueRecord(value.kappaGot) &&
    Array.isArray(value.customItems) &&
    value.customItems.every(isValidCustomItemEntry) &&
    isStringArray(value.pinnedItemIds) &&
    isStringArray(value.pinnedTaskIds) &&
    typeof value.playerLevel === "number" &&
    typeof value.prestigeLevel === "number" &&
    isNumberRecord(value.traderLevels) &&
    isNumberRecord(value.traderReputation)
  );
}

/**
 * `prestigeLevel` was added after `schemaVersion: 1` already shipped (2026-07-16
 * task-data audit) - any snapshot written before this field existed lacks it
 * entirely. Backfilling it to `0` here (before {@link isValidProfileProgress}
 * runs) keeps that validator's `prestigeLevel` check simple/sound (always a
 * real `number`, never optional) while still accepting old data instead of
 * discarding it outright.
 */
function withPrestigeLevelBackfill(value: unknown): unknown {
  if (!isRecord(value) || value.prestigeLevel !== undefined) return value;
  return { ...value, prestigeLevel: 0 };
}

/**
 * `faction` moved from `Profile` onto `ProfileProgress` in the 2026-08
 * game-mode rework (each mode-bucket is now its own character, with its own
 * faction). `migrateLegacySingleModeSnapshot` always attaches a real faction
 * to every bucket it rewrites, so this only matters defensively - a
 * hand-edited or otherwise corrupted "new-shape-looking" bucket that's
 * missing it defaults to `"BEAR"` rather than getting rejected outright,
 * same defensive spirit as {@link withPrestigeLevelBackfill}.
 */
function withFactionBackfill(value: unknown): unknown {
  if (!isRecord(value) || value.faction !== undefined) return value;
  return { ...value, faction: "BEAR" };
}

/** A `progressByProfile` key must look like `${profileId}:${mode}` with a non-empty profileId - matches {@link ProfileModeKey}. */
function hasValidProfileModeKeyShape(key: string): boolean {
  return PROFILE_MODES.some((mode) => {
    const suffix = `:${mode}`;
    return key.endsWith(suffix) && key.length > suffix.length;
  });
}

function toValidProfileProgressRecord(
  value: unknown,
): Record<ProfileModeKey, ProfileProgress> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, ProfileProgress> = {};
  for (const [key, rawEntry] of Object.entries(value)) {
    if (!hasValidProfileModeKeyShape(key)) return null;
    const entry = withFactionBackfill(withPrestigeLevelBackfill(rawEntry));
    if (!isValidProfileProgress(entry)) return null;
    result[key] = entry;
  }
  return result;
}

function isValidProfile(value: unknown): value is Profile {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.face === null || typeof value.face === "string")
  );
}

function toValidProfileList(value: unknown): Profile[] | null {
  if (!Array.isArray(value)) return null;
  const result: Profile[] = [];
  for (const entry of value) {
    if (!isValidProfile(entry)) return null;
    result.push(entry);
  }
  return result;
}

/**
 * Pre-2026-08 snapshots stored one mode + faction directly on each `Profile`
 * and kept exactly one progress bucket per profile id (`progressByProfile[id]`).
 * Detects that legacy shape (a raw profile object still carrying a `mode`
 * field) and rewrites the whole snapshot into the new composite-key shape
 * in place - never a `schemaVersion` bump, matching
 * {@link withPrestigeLevelBackfill}'s established "backfill under
 * `schemaVersion: 1` forever" convention. A no-op (returns `raw` unchanged)
 * for anything that isn't recognizably the legacy shape, including data
 * that's already been migrated or is malformed in some other way - the
 * normal validators below are what ultimately accept or reject it.
 */
function migrateLegacySingleModeSnapshot(raw: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) return raw;
  const legacyProfiles: unknown[] = raw.profiles;
  if (!legacyProfiles.every((entry) => isRecord(entry) && "mode" in entry)) return raw;

  const oldProgress = isRecord(raw.progressByProfile) ? raw.progressByProfile : {};
  const newProfiles: unknown[] = [];
  const newProgress: Record<string, unknown> = {};

  for (const entry of legacyProfiles) {
    if (!isRecord(entry)) continue;
    const id = entry.id;
    const mode = entry.mode;
    if (typeof id !== "string" || typeof mode !== "string") continue;

    const name = typeof entry.name === "string" ? entry.name : "";
    const face = entry.face === null || typeof entry.face === "string" ? entry.face : null;
    newProfiles.push({ id, name, face });

    const bucket = oldProgress[id];
    if (isRecord(bucket)) {
      newProgress[`${id}:${mode}`] = { ...bucket, faction: entry.faction };
    }
  }

  return {
    ...raw,
    profiles: newProfiles,
    progressByProfile: newProgress,
    activeMode: raw.activeMode ?? "PVP",
  };
}

/**
 * Full runtime shape validation against arbitrary/untrusted input (a
 * localStorage read, an imported file, a linked backup folder's file) -
 * never throws, returns `null` for anything malformed so callers can fall
 * back to an empty state instead of crashing. Beyond per-field shape checks,
 * also cross-validates referential integrity between `profiles`/
 * `activeProfileId`/`progressByProfile` - `store.ts`'s own live mutators
 * (`createProfile`/`createProfileMode` atomically write a profile/bucket
 * together; `switchProfile` refuses to set `activeProfileId` to anything not
 * already in `profiles`) guarantee this holds for any snapshot this app
 * itself ever wrote, so a violation only reaches here via external,
 * possibly hand-edited or corrupted input - rejected wholesale, matching
 * every other validator in this file's all-or-nothing convention, rather
 * than silently repaired (e.g. nulling out a dangling `activeProfileId`),
 * so a restore never leaves the app in a state `store.ts` itself could never
 * produce on its own.
 */
export function deserializeSnapshot(raw: unknown): ProgressTrackerSnapshot | null {
  if (!isRecord(raw)) return null;
  const migrated = migrateLegacySingleModeSnapshot(raw);

  if (migrated.schemaVersion !== 1) return null;
  if (typeof migrated.exportedAt !== "string") return null;

  const profiles = toValidProfileList(migrated.profiles);
  if (profiles === null) return null;

  if (migrated.activeProfileId !== null && typeof migrated.activeProfileId !== "string")
    return null;
  if (
    migrated.activeProfileId !== null &&
    !profiles.some((profile) => profile.id === migrated.activeProfileId)
  ) {
    return null;
  }

  const progressByProfile = toValidProfileProgressRecord(migrated.progressByProfile);
  if (progressByProfile === null) return null;
  // Every profile must have set up AT LEAST ONE mode (used to be "exactly
  // one bucket keyed by bare profile id" - now a profile can have up to 3).
  const progressKeys = Object.keys(progressByProfile);
  if (!profiles.every((profile) => progressKeys.some((key) => key.startsWith(`${profile.id}:`)))) {
    return null;
  }

  if (typeof migrated.autoStartNext !== "boolean") return null;

  const activeMode = isValidProfileMode(migrated.activeMode) ? migrated.activeMode : "PVP";

  return {
    schemaVersion: 1,
    exportedAt: migrated.exportedAt,
    profiles,
    activeProfileId: migrated.activeProfileId,
    activeMode,
    progressByProfile,
    autoStartNext: migrated.autoStartNext,
  };
}
