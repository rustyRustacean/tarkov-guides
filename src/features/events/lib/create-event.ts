import { rememberEvent } from "./my-events-storage";

import type { EventDocument } from "../types";

/**
 * Creates an event on the server and remembers its edit key in this
 * browser. Resolves to the new event's code; rejects with a message fit to
 * show the organizer.
 */
export async function createEvent(document: EventDocument): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/events/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    editKey?: string;
    reason?: string;
  };
  if (!response.ok || !body.code || !body.editKey) {
    throw new Error(body.reason ?? "Couldn't create the event. Try again.");
  }
  rememberEvent({ code: body.code, editKey: body.editKey, name: document.settings.name });
  return body.code;
}
