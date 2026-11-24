import type { ActivityEntry, Adjustment, EventDocument, Preset, RaidEntry, Team } from "../types";
import type { Json, LiveList, LiveMap, Lson } from "@liveblocks/client";

/**
 * The event room's Liveblocks Storage layout. Settings and columns are plain
 * JSON values replaced whole (rare, organizer-only edits). Teams, raid
 * entries and adjustments are `LiveMap`s keyed by id, so two scorers
 * writing different rows at once never overwrite each other; a raid
 * entry's key is deterministic (`entryIdFor`), so two scorers filling the
 * same team's raid update one entry instead of creating two.
 */
export interface EventStorage {
  [key: string]: Lson | undefined;
  version: number;
  settings: Json;
  columns: Json;
  teams: LiveMap<string, Json>;
  entries: LiveMap<string, Json>;
  adjustments: LiveMap<string, Json>;
  /** Role presets by id, each replaced whole on edit (one organizer edits a preset at a time). */
  presets: LiveMap<string, Json>;
  activity: LiveList<Json>;
}

/**
 * Widens one of this feature's plain-JSON interfaces to Liveblocks' `Json`.
 * TypeScript won't do it implicitly (an interface has no index signature),
 * even though every type in `types.ts` is JSON by construction. The one
 * place that cast happens.
 */
export function asJson(
  value:
    | EventDocument["settings"]
    | EventDocument["columns"]
    | Team
    | RaidEntry
    | Adjustment
    | Preset
    | ActivityEntry,
): Json {
  return value as unknown as Json;
}
