"use client";

import { useEffect, useMemo } from "react";

import { useEventSnapshot } from "../hooks/use-event-snapshot";
import { buildLeaderboards } from "../lib/scoring";

import { formatPoints } from "./event-ui";

/**
 * The stream overlay: a compact, high-contrast leaderboard on a transparent
 * page, for an OBS browser source. Polls the same snapshot as the view-only
 * page. `mode` picks one board when modes are ranked separately; `top`
 * limits how many teams show. Text keeps a dark outline so it reads over
 * any game footage.
 */
export function EventOverlay({
  code,
  mode,
  top,
}: {
  code: string;
  mode: string | null;
  top: number;
}) {
  const { data } = useEventSnapshot(code);

  useEffect(() => {
    document.documentElement.dataset.chromeless = "";
    return () => {
      delete document.documentElement.dataset.chromeless;
    };
  }, []);

  const board = useMemo(() => {
    if (!data) return null;
    const { boards } = buildLeaderboards(data.document);
    return boards.find((candidate) => candidate.id === mode) ?? boards[0] ?? null;
  }, [data, mode]);

  if (!data || !board) return null;
  const title =
    board.id === "combined"
      ? data.document.settings.name
      : `${data.document.settings.name} · ${board.label}`;

  return (
    <div
      className="text-white"
      style={{ textShadow: "0 0 3px #000, 0 0 6px #000, 0 1px 2px #000" }}
    >
      <div className="font-display mb-2 text-2xl font-bold">{title}</div>
      <ol className="flex flex-col gap-1">
        {board.rows.slice(0, top).map((row) => (
          <li
            key={row.team.id}
            className="flex items-center gap-3 rounded bg-black/55 px-3 py-1.5 text-xl font-semibold"
          >
            <span className="w-8 text-right tabular-nums">{row.place}</span>
            <span className="min-w-0 flex-1 truncate">{row.team.name}</span>
            <span className="tabular-nums">{formatPoints(row.total)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
