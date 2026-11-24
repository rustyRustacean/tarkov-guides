"use client";

import { RefreshCw } from "lucide-react";

import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { useEventSnapshot, EventSnapshotError } from "../hooks/use-event-snapshot";
import { useNow } from "../hooks/use-now";

import { formatAgo } from "./event-ui";
import { EventWorkspace } from "./EventWorkspace";

/** Shown in place of an event that's missing, deleted, or unreachable. */
export function EventUnavailable({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{body}</p>
      <TransitionLink href="/resources/events" className="text-primary text-sm underline">
        Back to events
      </TransitionLink>
    </div>
  );
}

/** The view-only scoreboard: the polled snapshot, rendered read-only. */
export function EventViewer({ code }: { code: string }) {
  const { data, error, isPending, isFetching } = useEventSnapshot(code);
  const now = useNow(5_000);

  if (isPending) return <p className="text-muted-foreground">Loading scoreboard...</p>;
  if (!data) {
    const notFound = error instanceof EventSnapshotError && error.notFound;
    return (
      <EventUnavailable
        title={notFound ? "Event not found" : "Scoreboard unavailable"}
        body={
          notFound
            ? "This event doesn't exist, or its organizer deleted it. Check the link you were given."
            : "Couldn't load the scoreboard. It'll keep trying; you can also refresh the page."
        }
      />
    );
  }

  return (
    <EventWorkspace
      doc={data.document}
      code={code}
      status={
        <span className="inline-flex items-center gap-2">
          <RefreshCw
            className={`size-3.5 ${isFetching ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          Updates on its own · last refreshed {formatAgo(data.fetchedAt, now)}
          {error && <span className="text-status-amber"> · reconnecting</span>}
        </span>
      }
    />
  );
}
