"use client";

import { Medal } from "lucide-react";
import { useMemo, useState } from "react";

import { PROFILE_MODE_LABELS } from "@/features/progress-tracker/types";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { buildLeaderboards, type Leaderboard } from "../lib/scoring";

import { formatPoints } from "./event-ui";

import type { EventDocument } from "../types";

/** First place stands out; every other place reads plainly. */
const PLACE_TONE: Readonly<Record<number, string>> = {
  1: "text-status-amber",
};

/** One leaderboard as a table: place, team, total, then per-raid (one mode) or per-mode (several) points, then stat totals. */
export function LeaderboardTable({ board, doc }: { board: Leaderboard; doc: EventDocument }) {
  const { settings } = doc;
  const statColumns = doc.columns.filter((column) => column.enabled);
  const singleMode = board.modes.length === 1 ? board.modes[0] : undefined;
  const raidCount = singleMode ? (settings.raidsPerMode[singleMode] ?? 0) : 0;
  const hasAdjustments = board.rows.some((row) => row.adjustmentPoints !== 0);

  if (board.rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No teams yet.</p>;
  }

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-sm">
        <caption className="sr-only">{board.label} leaderboard</caption>
        <thead className="bg-muted text-muted-foreground text-xs uppercase">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">
              Place
            </th>
            <th scope="col" className="px-3 py-2 text-left">
              Team
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Total
            </th>
            {singleMode
              ? Array.from({ length: raidCount }, (_, i) => (
                  <th key={i} scope="col" className="px-3 py-2 text-right">
                    Raid {i + 1}
                  </th>
                ))
              : board.modes.map((mode) => (
                  <th key={mode} scope="col" className="px-3 py-2 text-right">
                    {PROFILE_MODE_LABELS[mode]}
                  </th>
                ))}
            {hasAdjustments && (
              <th scope="col" className="px-3 py-2 text-right">
                Adj.
              </th>
            )}
            {statColumns.map((column) => (
              <th key={column.id} scope="col" className="px-3 py-2 text-right font-normal">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {board.rows.map((row) => (
            <tr key={row.team.id} className="border-border border-t">
              <td className={`px-3 py-2 font-bold tabular-nums ${PLACE_TONE[row.place] ?? ""}`}>
                <span className="inline-flex items-center gap-1">
                  {row.place <= 3 && row.raidsLogged > 0 && (
                    <Medal className="size-3.5" aria-hidden="true" />
                  )}
                  {row.place}
                </span>
              </td>
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {row.team.name}
                {row.team.players.some((player) => player.name) && (
                  <span className="text-muted-foreground block text-xs font-normal">
                    {row.team.players
                      .map((player) => player.name)
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
              </th>
              <td className="px-3 py-2 text-right text-base font-bold tabular-nums">
                {formatPoints(row.total)}
              </td>
              {singleMode
                ? Array.from({ length: raidCount }, (_, i) => {
                    const points = row.raidTotals[singleMode]?.[i] ?? null;
                    const counted = row.raidCounted[singleMode]?.[i] ?? true;
                    return (
                      <td
                        key={i}
                        className={`px-3 py-2 text-right tabular-nums ${counted ? "" : "text-muted-foreground line-through"}`}
                        title={counted ? undefined : "Not counted: outside this team's best raids"}
                      >
                        {points === null ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          formatPoints(points)
                        )}
                      </td>
                    );
                  })
                : board.modes.map((mode) => (
                    <td key={mode} className="px-3 py-2 text-right tabular-nums">
                      {formatPoints(row.modeTotals[mode] ?? 0)}
                    </td>
                  ))}
              {hasAdjustments && (
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.adjustmentPoints === 0
                    ? "-"
                    : `${row.adjustmentPoints > 0 ? "+" : ""}${formatPoints(row.adjustmentPoints)}`}
                </td>
              )}
              {statColumns.map((column) => (
                <td
                  key={column.id}
                  className="text-muted-foreground px-3 py-2 text-right tabular-nums"
                >
                  {row.columnTotals[column.id] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The event's standings. One table, or a mode switch above one table per
 * mode when the organizer ranks modes separately. Recomputed from the raw
 * raid log on every render, so a point change shows everywhere at once.
 */
export function LeaderboardPanel({ doc }: { doc: EventDocument }) {
  const { boards, notes } = useMemo(() => buildLeaderboards(doc), [doc]);
  const [boardId, setBoardId] = useState<string>(boards[0]?.id ?? "combined");
  const board = boards.find((candidate) => candidate.id === boardId) ?? boards[0];
  if (!board) return null;

  return (
    <div className="flex flex-col gap-4">
      {boards.length > 1 && (
        <SegmentedControl
          aria-label="Leaderboard"
          className="max-w-md"
          options={boards.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
          value={board.id}
          onChange={setBoardId}
        />
      )}
      <LeaderboardTable board={board} doc={doc} />
      {doc.settings.bestRaids !== null && (
        <p className="text-muted-foreground text-xs">
          Only each team&apos;s best {doc.settings.bestRaids}{" "}
          {doc.settings.bestRaids === 1 ? "raid counts" : "raids count"} per mode. Struck-through
          raids don&apos;t count.
        </p>
      )}
      {notes.unassignedAdjustmentIds.length > 0 && (
        <p className="text-status-amber text-xs">
          {notes.unassignedAdjustmentIds.length} adjustment
          {notes.unassignedAdjustmentIds.length === 1 ? " isn't" : "s aren't"} counted: each mode is
          ranked separately, so give them a mode on the Adjustments tab.
        </p>
      )}
    </div>
  );
}
