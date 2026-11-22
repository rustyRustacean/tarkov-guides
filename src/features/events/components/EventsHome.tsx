"use client";

import { FileUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { useNow } from "../hooks/use-now";
import { createEvent } from "../lib/create-event";
import { eventViewPath } from "../lib/event-code";
import { parseEventImport } from "../lib/export";
import { forgetEvent, useRememberedEvents } from "../lib/my-events-storage";

import { formatAgo } from "./event-ui";

/** Imports can't be bigger than the create route accepts. */
const MAX_IMPORT_BYTES = 1_000_000;

function ImportButton() {
  const router = useRouter();
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const importFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError("That file is too large to be an event export.");
      return;
    }
    const document = parseEventImport(await file.text());
    if (!document) {
      setError("That isn't an event export from this site.");
      return;
    }
    setBusy(true);
    try {
      const code = await createEvent(document);
      router.push(eventViewPath(code));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't import the event.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        id={inputId}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
      <Button asChild variant="outline" className="self-start">
        <label htmlFor={inputId} className="cursor-pointer">
          <FileUp className="size-4" aria-hidden="true" />
          {busy ? "Importing..." : "Import from JSON"}
        </label>
      </Button>
      {error && (
        <p role="alert" className="text-status-red text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** The events landing page: start or import an event, and reopen the ones this browser can edit. */
export function EventsHome() {
  const events = useRememberedEvents();
  const now = useNow(60_000);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Run an event</CardTitle>
            <CardDescription>
              A live scoreboard for PvP, Seasonal or PvE events: teams from solo to 5-stack, your
              own point values, item bonuses and penalties. Share a view link that updates on its
              own, an edit link for co-scorers, and a stream overlay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <TransitionLink href="/resources/events/new">
                <Plus className="size-4" aria-hidden="true" />
                Create an event
              </TransitionLink>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Start from an export</CardTitle>
            <CardDescription>
              Import an event&apos;s JSON export (from its Share tab) as a new event, to rerun a
              format or restore a backup. The original isn&apos;t touched.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportButton />
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="your-events" className="flex flex-col gap-3">
        <h2 id="your-events" className="font-display text-xl font-bold">
          Your events
        </h2>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Events you create, or open with an edit link, show up here on this browser.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {events.map((event) => (
              <li key={event.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <TransitionLink
                  href={eventViewPath(event.code)}
                  className="min-w-0 flex-1 font-medium hover:underline"
                >
                  {event.name}
                </TransitionLink>
                <span className="text-muted-foreground text-xs">
                  Added {formatAgo(event.savedAt, now)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    forgetEvent(event.code);
                  }}
                >
                  Forget
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
