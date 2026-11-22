"use client";

import { useNow } from "../hooks/use-now";

import { formatAgo } from "./event-ui";

import type { ActivityEntry } from "../types";

/** Who changed what, newest first. Editors only: the snapshot viewers read leaves it out. */
export function ActivityPanel({ activity }: { activity: readonly ActivityEntry[] }) {
  const now = useNow();
  const lines = [...activity].reverse();
  if (lines.length === 0) return <p className="text-muted-foreground text-sm">Nothing yet.</p>;
  return (
    <ol className="border-border divide-border max-w-3xl divide-y rounded-lg border">
      {lines.map((line, index) => (
        <li key={`${String(line.at)}-${String(index)}`} className="flex gap-3 px-3 py-2 text-sm">
          <time
            dateTime={new Date(line.at).toISOString()}
            title={new Date(line.at).toLocaleString()}
            className="text-muted-foreground w-20 shrink-0 tabular-nums"
          >
            {formatAgo(line.at, now)}
          </time>
          <span className="w-28 shrink-0 truncate font-medium">{line.by}</span>
          <span className="min-w-0 flex-1">{line.summary}</span>
        </li>
      ))}
    </ol>
  );
}
