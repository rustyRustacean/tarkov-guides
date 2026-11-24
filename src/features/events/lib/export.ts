import { PROFILE_MODE_LABELS } from "@/features/progress-tracker/types";

import { parseEventDocument } from "./event-schema";
import { buildLeaderboards, scoreEntry } from "./scoring";

import type { EventDocument } from "../types";

/** Marks a JSON export so an import can tell it apart from any other JSON file. */
const EXPORT_FORMAT = "tarkovguides-event";

/**
 * One CSV cell. Text that a spreadsheet would read as a formula (starting
 * with `=`, `+`, `-`, `@`, tab or CR) gets a leading apostrophe: team names
 * are typed by anyone with the edit link, and the file is meant to be opened
 * in Excel or Sheets. Numbers are written as-is.
 */
function cell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csv(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Every logged raid as one CSV row: team, mode, raid, a count per enabled column, points, note. */
export function raidLogCsv(doc: EventDocument): string {
  const columns = doc.columns.filter((column) => column.enabled);
  const teamOrder = new Map(Object.values(doc.teams).map((team) => [team.id, team.order]));
  const entries = Object.values(doc.entries).sort(
    (a, b) =>
      (teamOrder.get(a.teamId) ?? 0) - (teamOrder.get(b.teamId) ?? 0) ||
      doc.settings.modes.indexOf(a.mode) - doc.settings.modes.indexOf(b.mode) ||
      a.raid - b.raid,
  );
  return csv([
    ["Team", "Mode", "Raid", ...columns.map((column) => column.label), "Points", "Note"],
    ...entries.map((entry) => [
      doc.teams[entry.teamId]?.name ?? "",
      PROFILE_MODE_LABELS[entry.mode],
      entry.raid,
      ...columns.map((column) => entry.counts[column.id] ?? 0),
      scoreEntry(entry, doc.columns, doc.settings).total,
      entry.note,
    ]),
  ]);
}

/** Every leaderboard as CSV rows: board, place, team, total, raids logged, points per mode, adjustments. */
export function leaderboardCsv(doc: EventDocument): string {
  const { boards } = buildLeaderboards(doc);
  const modes = doc.settings.modes;
  const rows: (string | number)[][] = [
    [
      "Leaderboard",
      "Place",
      "Team",
      "Total",
      "Raids logged",
      ...modes.map((mode) => `${PROFILE_MODE_LABELS[mode]} points`),
      "Adjustments",
    ],
  ];
  for (const board of boards) {
    for (const row of board.rows) {
      rows.push([
        board.label,
        row.place,
        row.team.name,
        row.total,
        row.raidsLogged,
        ...modes.map((mode) => row.modeTotals[mode] ?? 0),
        row.adjustmentPoints,
      ]);
    }
  }
  return csv(rows);
}

/** The whole event as a JSON file, re-importable as a new event. The activity log is left out. */
export function eventJson(doc: EventDocument, exportedAt = new Date()): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt: exportedAt.toISOString(),
      document: { ...doc, activity: [] },
    },
    null,
    2,
  );
}

/** Reads a JSON export back into a document for a new event, or `null` when it isn't one. */
export function parseEventImport(text: string): EventDocument | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const wrapper = parsed as { format?: unknown; document?: unknown };
  if (wrapper.format !== EXPORT_FORMAT) return null;
  const document = parseEventDocument(wrapper.document);
  return document ? { ...document, activity: [] } : null;
}

/** A filesystem-safe file name stem from an event name. */
export function exportFileStem(name: string): string {
  const stem = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return stem || "event";
}
