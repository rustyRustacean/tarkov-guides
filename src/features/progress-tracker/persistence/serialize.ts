import type { ProgressTrackerSnapshot } from "./types";
import type {
  CustomItemEntry,
  HideoutGoal,
  Profile,
  ProfileProgress,
  TaskProgress,
  TaskStatus,
} from "../types";

interface SerializableState {
  profiles: readonly Profile[];
  activeProfileId: string | null;
  progressByProfile: Readonly<Record<string, ProfileProgress>>;
  autoStartNext: boolean;
}

/** The one canonical serializer - every persistence backend (localStorage, FSA folder, manual export) calls this, never hand-builds its own payload shape. */
export function serializeSnapshot(state: SerializableState): ProgressTrackerSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
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

function toValidProfileProgressRecord(value: unknown): Record<string, ProfileProgress> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, ProfileProgress> = {};
  for (const [profileId, rawEntry] of Object.entries(value)) {
    const entry = withPrestigeLevelBackfill(rawEntry);
    if (!isValidProfileProgress(entry)) return null;
    result[profileId] = entry;
  }
  return result;
}

function isValidProfile(value: unknown): value is Profile {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.mode === "PVP" || value.mode === "PVE") &&
    (value.faction === "BEAR" || value.faction === "USEC") &&
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
 * Full runtime shape validation against arbitrary/untrusted input (a
 * localStorage read, an imported file, a linked backup folder's file) -
 * never throws, returns `null` for anything malformed so callers can fall
 * back to an empty state instead of crashing. Beyond per-field shape checks,
 * also cross-validates referential integrity between `profiles`/
 * `activeProfileId`/`progressByProfile` - `store.ts`'s own live mutators
 * (`createProfile` atomically writes both a profile AND its progress bucket
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
  if (raw.schemaVersion !== 1) return null;
  if (typeof raw.exportedAt !== "string") return null;

  const profiles = toValidProfileList(raw.profiles);
  if (profiles === null) return null;

  if (raw.activeProfileId !== null && typeof raw.activeProfileId !== "string") return null;
  if (
    raw.activeProfileId !== null &&
    !profiles.some((profile) => profile.id === raw.activeProfileId)
  ) {
    return null;
  }

  const progressByProfile = toValidProfileProgressRecord(raw.progressByProfile);
  if (progressByProfile === null) return null;
  if (!profiles.every((profile) => profile.id in progressByProfile)) return null;

  if (typeof raw.autoStartNext !== "boolean") return null;

  return {
    schemaVersion: 1,
    exportedAt: raw.exportedAt,
    profiles,
    activeProfileId: raw.activeProfileId,
    progressByProfile,
    autoStartNext: raw.autoStartNext,
  };
}
