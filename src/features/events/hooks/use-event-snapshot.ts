"use client";

import { useQuery } from "@tanstack/react-query";

import { parseEventDocument } from "../lib/event-schema";

import type { EventDocument } from "../types";

/**
 * How often a view-only page asks for a fresh scoreboard. Matches the
 * route's 5 s CDN cache: polling faster would only get the same cached copy.
 */
export const SNAPSHOT_POLL_MS = 5_000;

/** A failed snapshot request, with whether the event is gone (404) or just unreachable. */
export class EventSnapshotError extends Error {
  constructor(readonly notFound: boolean) {
    super(notFound ? "Event not found" : "Scoreboard unavailable");
  }
}

async function fetchSnapshot(
  code: string,
): Promise<{ document: EventDocument; fetchedAt: number }> {
  const response = await fetch(`/api/events/${code}/snapshot`);
  if (!response.ok) throw new EventSnapshotError(response.status === 404);
  const body = (await response.json()) as { document?: unknown; fetchedAt?: unknown };
  const document = parseEventDocument(body.document);
  if (!document) throw new EventSnapshotError(true);
  return {
    document,
    fetchedAt: typeof body.fetchedAt === "number" ? body.fetchedAt : Date.now(),
  };
}

/**
 * The view-only scoreboard, polled every {@link SNAPSHOT_POLL_MS} while the
 * tab is visible (React Query pauses interval refetches for hidden tabs).
 * Kept out of the persisted query cache: it's stale within seconds.
 */
export function useEventSnapshot(code: string) {
  return useQuery({
    queryKey: ["event-snapshot", code],
    queryFn: () => fetchSnapshot(code),
    refetchInterval: (query) =>
      query.state.error instanceof EventSnapshotError && query.state.error.notFound
        ? false
        : SNAPSHOT_POLL_MS,
    staleTime: 0,
    retry: (failureCount, error) =>
      !(error instanceof EventSnapshotError && error.notFound) && failureCount < 2,
    meta: { persist: false },
  });
}
