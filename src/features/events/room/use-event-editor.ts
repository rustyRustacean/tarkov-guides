"use client";

import { useMemo } from "react";

import { PROFILE_MODE_LABELS, type ProfileMode } from "@/features/progress-tracker/types";

import { EVENT_LIMITS, parseEventDocument } from "../lib/event-schema";
import {
  entryIdFor,
  type ActivityEntry,
  type Adjustment,
  type EventDocument,
  type EventSettings,
  type Preset,
  type RaidEntry,
  type ScoreColumn,
  type Team,
} from "../types";

import { useEventMutation, useEventStorage } from "./event-room";
import { asJson } from "./event-storage";

import type { Json, LiveList } from "@liveblocks/client";

/** Repeat edits of the same thing by the same scorer within this window share one activity line. */
const COALESCE_MS = 60_000;

/** Appends an activity line, folding it into the previous one when it's a quick repeat of the same edit. */
function logActivity(list: LiveList<Json>, line: ActivityEntry): void {
  const last =
    list.length > 0 ? (list.get(list.length - 1) as Partial<ActivityEntry> | undefined) : undefined;
  if (
    line.key &&
    last?.key === line.key &&
    last.by === line.by &&
    typeof last.at === "number" &&
    line.at - last.at < COALESCE_MS
  ) {
    list.set(list.length - 1, asJson(line));
    return;
  }
  list.push(asJson(line));
  while (list.length > EVENT_LIMITS.activity) list.delete(0);
}

/** The live, validated event document, or `null` while loading or when the room holds no valid event. */
export function useLiveEventDocument(): { document: EventDocument | null; loading: boolean } {
  const root = useEventStorage((storage) => storage);
  return useMemo(
    () => ({ document: root === null ? null : parseEventDocument(root), loading: root === null }),
    [root],
  );
}

/** Every change an editor can make. Each writes one activity line labeled with the scorer's name. */
export interface EventEditor {
  setSettings: (settings: EventSettings, summary: string) => void;
  setColumns: (columns: ScoreColumn[], summary: string) => void;
  upsertTeam: (team: Team, summary: string) => void;
  /** Removes the team and its raid entries and adjustments. */
  deleteTeam: (team: Team) => void;
  setCount: (args: {
    team: Team;
    mode: ProfileMode;
    raid: number;
    column: ScoreColumn;
    count: number;
  }) => void;
  setNote: (args: { team: Team; mode: ProfileMode; raid: number; note: string }) => void;
  clearEntry: (args: { team: Team; mode: ProfileMode; raid: number }) => void;
  addAdjustment: (adjustment: Adjustment, teamName: string) => void;
  deleteAdjustment: (adjustment: Adjustment, teamName: string) => void;
  /** Adds or replaces a role preset. */
  upsertPreset: (preset: Preset, summary: string) => void;
  /** Removes a role preset, and unassigns it from every player who had it. */
  deletePreset: (preset: Preset) => void;
}

function raidLabel(mode: ProfileMode, raid: number): string {
  return `${PROFILE_MODE_LABELS[mode]} raid ${String(raid)}`;
}

/** The editing operations for the event room this component is inside. `by` labels the activity log. */
export function useEventEditor(by: string): EventEditor {
  const scorer = by || "Scorer";

  const setSettings = useEventMutation(
    ({ storage }, settings: EventSettings, summary: string) => {
      storage.set("settings", asJson(settings));
      logActivity(storage.get("activity"), { at: Date.now(), by: scorer, summary });
    },
    [scorer],
  );

  const setColumns = useEventMutation(
    ({ storage }, columns: ScoreColumn[], summary: string) => {
      storage.set("columns", asJson(columns));
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary,
        key: `columns:${summary}`,
      });
    },
    [scorer],
  );

  const upsertTeam = useEventMutation(
    ({ storage }, team: Team, summary: string) => {
      storage.get("teams").set(team.id, asJson(team));
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary,
        key: `team:${team.id}:${summary}`,
      });
    },
    [scorer],
  );

  const deleteTeam = useEventMutation(
    ({ storage }, team: Team) => {
      storage.get("teams").delete(team.id);
      const entries = storage.get("entries");
      for (const key of [...entries.keys()]) {
        if (key.startsWith(`${team.id}:`)) entries.delete(key);
      }
      const adjustments = storage.get("adjustments");
      for (const [key, value] of [...adjustments.entries()]) {
        if ((value as Partial<Adjustment> | null)?.teamId === team.id) adjustments.delete(key);
      }
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary: `Removed team ${team.name} and its scores`,
      });
    },
    [scorer],
  );

  const writeEntry = useEventMutation(
    (
      { storage },
      args: {
        team: Team;
        mode: ProfileMode;
        raid: number;
        change: (entry: RaidEntry) => RaidEntry;
      },
      summary: string,
      key: string,
    ) => {
      const id = entryIdFor(args.team.id, args.mode, args.raid);
      const entries = storage.get("entries");
      const stored = entries.get(id) as Partial<RaidEntry> | undefined;
      const base: RaidEntry = {
        id,
        teamId: args.team.id,
        mode: args.mode,
        raid: args.raid,
        counts: { ...(stored?.counts ?? {}) },
        note: typeof stored?.note === "string" ? stored.note : "",
        updatedAt: 0,
      };
      entries.set(id, asJson({ ...args.change(base), updatedAt: Date.now() }));
      logActivity(storage.get("activity"), { at: Date.now(), by: scorer, summary, key });
    },
    [scorer],
  );

  const clearEntryMutation = useEventMutation(
    ({ storage }, args: { team: Team; mode: ProfileMode; raid: number }, label: string) => {
      storage.get("entries").delete(entryIdFor(args.team.id, args.mode, args.raid));
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary: `Cleared ${args.team.name}'s ${label}`,
      });
    },
    [scorer],
  );

  const addAdjustment = useEventMutation(
    ({ storage }, adjustment: Adjustment, teamName: string) => {
      storage.get("adjustments").set(adjustment.id, asJson(adjustment));
      const sign = adjustment.points > 0 ? "+" : "";
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary: `${sign}${String(adjustment.points)} for ${teamName}${adjustment.reason ? ` (${adjustment.reason})` : ""}`,
      });
    },
    [scorer],
  );

  const deleteAdjustment = useEventMutation(
    ({ storage }, adjustment: Adjustment, teamName: string) => {
      storage.get("adjustments").delete(adjustment.id);
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary: `Removed a ${String(adjustment.points)} adjustment for ${teamName}`,
      });
    },
    [scorer],
  );

  const upsertPreset = useEventMutation(
    ({ storage }, preset: Preset, summary: string) => {
      storage.get("presets").set(preset.id, asJson(preset));
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary,
        key: `preset:${preset.id}`,
      });
    },
    [scorer],
  );

  const deletePreset = useEventMutation(
    ({ storage }, preset: Preset) => {
      storage.get("presets").delete(preset.id);
      const teams = storage.get("teams");
      for (const [id, value] of [...teams.entries()]) {
        const team = value as Partial<Team> | null;
        if (!team?.players?.some((player) => player.roleId === preset.id)) continue;
        teams.set(
          id,
          asJson({
            ...(team as Team),
            players: (team as Team).players.map((player) =>
              player.roleId === preset.id ? { ...player, roleId: null } : player,
            ),
          }),
        );
      }
      logActivity(storage.get("activity"), {
        at: Date.now(),
        by: scorer,
        summary: `Removed role preset ${preset.name}`,
      });
    },
    [scorer],
  );

  return useMemo<EventEditor>(
    () => ({
      setSettings,
      setColumns,
      upsertTeam,
      deleteTeam,
      setCount: ({ team, mode, raid, column, count }) => {
        writeEntry(
          {
            team,
            mode,
            raid,
            change: (entry) => {
              const counts = Object.fromEntries(
                Object.entries(entry.counts).filter(([id]) => id !== column.id),
              );
              if (count > 0) counts[column.id] = count;
              return { ...entry, counts };
            },
          },
          `${team.name}, ${raidLabel(mode, raid)}: ${column.label} ${String(count)}`,
          `count:${team.id}:${mode}:${String(raid)}:${column.id}`,
        );
      },
      setNote: ({ team, mode, raid, note }) => {
        writeEntry(
          { team, mode, raid, change: (entry) => ({ ...entry, note }) },
          `${team.name}, ${raidLabel(mode, raid)}: note updated`,
          `note:${team.id}:${mode}:${String(raid)}`,
        );
      },
      clearEntry: (args) => {
        clearEntryMutation(args, raidLabel(args.mode, args.raid));
      },
      addAdjustment,
      deleteAdjustment,
      upsertPreset,
      deletePreset,
    }),
    [
      upsertPreset,
      deletePreset,
      setSettings,
      setColumns,
      upsertTeam,
      deleteTeam,
      writeEntry,
      clearEntryMutation,
      addAdjustment,
      deleteAdjustment,
    ],
  );
}
