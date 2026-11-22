"use client";

import { Users } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card/Card";

import { EVENT_LIMITS } from "../lib/event-schema";
import {
  forgetEvent,
  renameRememberedEvent,
  saveScorerName,
  useScorerName,
} from "../lib/my-events-storage";
import {
  EventRoomProvider,
  useEventAuthStore,
  useEventOthers,
  useEventStatus,
} from "../room/event-room";
import { useEventEditor, useLiveEventDocument } from "../room/use-event-editor";

import { INPUT_CLASS, LABEL_CLASS } from "./event-ui";
import { EventUnavailable } from "./EventViewer";
import { EventWorkspace } from "./EventWorkspace";

import type { SubmitEvent } from "react";

/** Asks once for the name shown next to this scorer's changes in the activity log. */
function ScorerNamePrompt() {
  const [name, setName] = useState("");
  const fieldId = useId();
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveScorerName(name.trim() || "Scorer");
  };
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Who&apos;s scoring?</CardTitle>
        <CardDescription>
          Your name labels your changes in the activity log, so co-scorers can tell who entered
          what. It&apos;s saved on this browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor={fieldId} className={LABEL_CLASS}>
            Display name
          </label>
          <input
            id={fieldId}
            className={INPUT_CLASS}
            maxLength={EVENT_LIMITS.scorerName}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <Button type="submit" className="self-start">
            Start scoring
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EditorBody({
  code,
  editKey,
  scorerName,
}: {
  code: string;
  editKey: string;
  scorerName: string;
}) {
  const { document, loading } = useLiveEventDocument();
  const editor = useEventEditor(scorerName);
  const status = useEventStatus();
  const others = useEventOthers((list) => list.map((other) => other.info.name));
  const problem = useEventAuthStore((state) => state.problem);
  const name = document?.settings.name;

  // Keep the "Your events" list showing the event's current name.
  useEffect(() => {
    if (name) renameRememberedEvent(code, name);
  }, [code, name]);

  if (problem && problem.kind !== "unavailable") {
    return (
      <div className="flex flex-col gap-4">
        <EventUnavailable
          title={problem.kind === "forbidden" ? "This edit link doesn't work" : "Event not found"}
          body={problem.reason}
        />
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            forgetEvent(code);
          }}
        >
          Forget this edit link
        </Button>
      </div>
    );
  }
  if (loading) return <p className="text-muted-foreground">Connecting to the event...</p>;
  if (!document) {
    return (
      <EventUnavailable
        title="This event can't be opened"
        body="Its data is missing or damaged. If you exported it, you can import the JSON as a new event."
      />
    );
  }

  const otherNames = [...new Set(others)];
  return (
    <EventWorkspace
      doc={document}
      code={code}
      editing={{ editor, editKey }}
      status={
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Scoring as <strong className="text-foreground">{scorerName}</strong>
          </span>
          {status !== "connected" && (
            <span className="text-status-amber">
              {status === "reconnecting" ? "Reconnecting: changes sync when back" : "Connecting..."}
            </span>
          )}
          {otherNames.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden="true" />
              Also scoring: {otherNames.join(", ")}
            </span>
          )}
          {problem?.kind === "unavailable" && (
            <span className="text-status-amber">{problem.reason}</span>
          )}
        </span>
      }
    />
  );
}

/** The editing view: joins the event's room with the edit key, after asking the scorer's name once. */
export function EventEditorView({ code, editKey }: { code: string; editKey: string }) {
  const scorerName = useScorerName();
  if (!scorerName) return <ScorerNamePrompt />;
  return (
    <EventRoomProvider code={code} editKey={editKey} displayName={scorerName}>
      <EditorBody code={code} editKey={editKey} scorerName={scorerName} />
    </EventRoomProvider>
  );
}
