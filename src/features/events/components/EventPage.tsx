"use client";

import { useEffect } from "react";

import { editKeyFromHash } from "../lib/event-code";
import { rememberEvent, useRememberedEditKey } from "../lib/my-events-storage";

import { EventEditorView } from "./EventEditorView";
import { EventViewer } from "./EventViewer";

/**
 * An event's page. Opening an edit link (`#edit=<key>`) stores the key in
 * this browser and strips it from the address bar, so it isn't left on
 * screen, in a screenshot, or copied along with the view URL; from then on
 * this browser opens the event for editing. `viewOnly` (the `?as=viewer`
 * link on the Share tab) shows the public view even when a key is stored.
 */
export function EventPage({ code, viewOnly }: { code: string; viewOnly: boolean }) {
  const editKey = useRememberedEditKey(code);

  useEffect(() => {
    const key = editKeyFromHash(window.location.hash);
    if (!key) return;
    rememberEvent({ code, editKey: key, name: "" });
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  }, [code]);

  if (editKey && !viewOnly) return <EventEditorView key={editKey} code={code} editKey={editKey} />;
  return <EventViewer code={code} />;
}
