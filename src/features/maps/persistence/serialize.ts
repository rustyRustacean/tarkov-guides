import { DEFAULT_TOP_DOLLAR_THRESHOLD_RUB } from "../lib/map-valuables";
import { withoutAnnotations } from "../types";

import type {
  CustomMapEntry,
  FractionalPoint,
  MapAnnotationLayer,
  MapProfileState,
  Stroke,
} from "../types";
import type { MapsSnapshot } from "./types";

interface SerializableState {
  currentMap: string;
  customMaps: Readonly<Record<string, readonly CustomMapEntry[]>>;
  profileState: Readonly<Record<string, MapProfileState>>;
  topDollarThresholdRub: number;
  persistDrawingsAcrossReload: boolean;
}

/**
 * The one canonical serializer: every persistence backend calls this rather
 * than hand-building its own payload shape (see `MapsSnapshot`'s doc
 * comment). When `persistDrawingsAcrossReload` is off (the default), every
 * profile's `annotations` are stripped before writing, so a drawing never
 * actually reaches localStorage unless the user opted in; `store.ts`'s
 * `hydrate` applies the same strip again on read, since a snapshot saved
 * from an earlier session with the toggle on could otherwise resurrect old
 * drawings after the user turns it back off.
 */
export function serializeSnapshot(state: SerializableState): MapsSnapshot {
  const profileState = state.persistDrawingsAcrossReload
    ? state.profileState
    : Object.fromEntries(
        Object.entries(state.profileState).map(([id, profile]) => [
          id,
          withoutAnnotations(profile),
        ]),
      );
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    currentMap: state.currentMap,
    customMaps: state.customMaps,
    profileState,
    topDollarThresholdRub: state.topDollarThresholdRub,
    persistDrawingsAcrossReload: state.persistDrawingsAcrossReload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidFractionalPoint(value: unknown): value is FractionalPoint {
  if (!isRecord(value)) return false;
  return typeof value.fx === "number" && typeof value.fy === "number";
}

function isValidStroke(value: unknown): value is Stroke {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.color !== "string" ||
    typeof value.width !== "number"
  ) {
    return false;
  }
  if (value.type === "pen") {
    return Array.isArray(value.points) && value.points.every(isValidFractionalPoint);
  }
  if (value.type === "circle") {
    return isValidFractionalPoint(value.center) && isValidFractionalPoint(value.edge);
  }
  if (value.type === "rect") {
    return (
      isValidFractionalPoint(value.corner1) &&
      isValidFractionalPoint(value.corner2) &&
      typeof value.rotation === "number"
    );
  }
  return false;
}

// A pre-rect-tool snapshot's stray `locks` array (the removed lock-area
// feature) is simply ignored here, not rejected: `isValidStroke` above no
// longer accepts a stroke with a `locks`-only shape, and this validator only
// ever reads `value.strokes` off an already-narrowed record, so an old
// snapshot with leftover `locks` data still deserializes cleanly, just
// without it.
function isValidAnnotationLayer(value: unknown): value is MapAnnotationLayer {
  if (!isRecord(value)) return false;
  return Array.isArray(value.strokes) && value.strokes.every(isValidStroke);
}

function toValidAnnotationsRecord(
  value: unknown,
): Record<string, Record<string, MapAnnotationLayer>> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, Record<string, MapAnnotationLayer>> = {};
  for (const [mapId, byVariant] of Object.entries(value)) {
    if (!isRecord(byVariant)) return null;
    const variants: Record<string, MapAnnotationLayer> = {};
    for (const [variantId, layer] of Object.entries(byVariant)) {
      if (!isValidAnnotationLayer(layer)) return null;
      variants[variantId] = layer;
    }
    result[mapId] = variants;
  }
  return result;
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function isValidMapProfileState(value: unknown): value is MapProfileState {
  if (!isRecord(value)) return false;
  const annotations = toValidAnnotationsRecord(value.annotations);
  return annotations !== null && isBooleanRecord(value.taskDisplayOverrides);
}

function toValidProfileStateRecord(value: unknown): Record<string, MapProfileState> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, MapProfileState> = {};
  for (const [profileId, entry] of Object.entries(value)) {
    if (!isValidMapProfileState(entry)) return null;
    result[profileId] = entry;
  }
  return result;
}

function isValidCustomMapEntry(value: unknown): value is CustomMapEntry {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.label === "string" && value.custom === true;
}

function toValidCustomMapsRecord(value: unknown): Record<string, CustomMapEntry[]> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, CustomMapEntry[]> = {};
  for (const [mapId, entries] of Object.entries(value)) {
    if (!Array.isArray(entries) || !entries.every(isValidCustomMapEntry)) return null;
    result[mapId] = entries;
  }
  return result;
}

/**
 * Full runtime shape validation against untrusted input (a localStorage
 * read). Never throws; returns `null` for anything malformed so callers
 * fall back to an empty state instead of crashing. Mirrors
 * `progress-tracker/persistence/serialize.ts`'s `deserializeSnapshot`.
 */
export function deserializeSnapshot(raw: unknown): MapsSnapshot | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== 1) return null;
  if (typeof raw.exportedAt !== "string") return null;
  if (typeof raw.currentMap !== "string") return null;

  const customMaps = toValidCustomMapsRecord(raw.customMaps);
  if (customMaps === null) return null;

  const profileState = toValidProfileStateRecord(raw.profileState);
  if (profileState === null) return null;

  // Defaulted rather than rejecting the snapshot: this field was added after
  // schemaVersion 1 shipped, so an otherwise-valid pre-existing snapshot
  // shouldn't get wiped over one new setting.
  const topDollarThresholdRub =
    typeof raw.topDollarThresholdRub === "number"
      ? raw.topDollarThresholdRub
      : DEFAULT_TOP_DOLLAR_THRESHOLD_RUB;

  // Same "defaulted, not rejected" reasoning as `topDollarThresholdRub`
  // above: a pre-existing snapshot from before this setting existed simply
  // gets the new off-by-default behavior, which also happens to be exactly
  // right for that transition (see `store.ts`'s `hydrate`, which strips any
  // already-saved drawings whenever this is `false`).
  const persistDrawingsAcrossReload =
    typeof raw.persistDrawingsAcrossReload === "boolean" ? raw.persistDrawingsAcrossReload : false;

  return {
    schemaVersion: 1,
    exportedAt: raw.exportedAt,
    currentMap: raw.currentMap,
    customMaps,
    profileState,
    topDollarThresholdRub,
    persistDrawingsAcrossReload,
  };
}
