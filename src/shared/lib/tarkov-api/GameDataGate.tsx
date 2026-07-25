"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/button/Button";

import { useTarkovGameData } from "./use-tarkov-game-data";

import type { ReactNode } from "react";

export interface GameDataGateProps {
  children: ReactNode;
}

/**
 * Gates a subtree that depends on `useTarkovGameData()` - directly, or
 * transitively via `useTaskActions`/`useHideoutTracker`/
 * `useMapSidebarHasContent` - behind that query's real load state (fixes
 * H-2: every one of the ~21 call sites under this gate destructures only
 * `{ data }` and falls back to `data?.x ?? []`, so a first load or a
 * permanent fetch failure previously rendered as indistinguishable from
 * genuine zero-progress). Mount this ABOVE the subtree, not inside it -
 * leaves keep calling `useTarkovGameData()` themselves; same query key, so
 * once this gate has confirmed `data !== undefined` their own call is an
 * instant cache read, not a second fetch.
 *
 * Lives here rather than `src/shared/ui/` because it's coupled to this one
 * hook/query, not a domain-agnostic UI primitive - the first renderable
 * `.tsx` in this folder.
 *
 * `data !== undefined` wins over `isError` on purpose (stale-while-
 * revalidate): once any data has ever loaded - including from the 24h
 * persisted localStorage cache on a fresh page load - a failed background
 * refetch (the hourly `refetchInterval`, or a manual retry) never yanks
 * working content away in favor of an error screen. Only a fetch that has
 * never once succeeded in this cache's lifetime shows the error state.
 */
export function GameDataGate({ children }: GameDataGateProps) {
  const { data, isError, error, refetch } = useTarkovGameData();

  if (data !== undefined) {
    return <>{children}</>;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="border-status-red bg-status-red-soft text-status-red flex min-h-60 flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center text-sm"
      >
        <p>Failed to load Tarkov data{error.message ? `: ${error.message}` : "."}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="border-border bg-card text-muted-foreground flex min-h-60 flex-col items-center justify-center gap-3 rounded-lg border p-8 text-sm"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span>Loading Tarkov data…</span>
    </div>
  );
}
