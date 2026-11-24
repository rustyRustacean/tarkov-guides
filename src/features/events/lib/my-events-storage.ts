import { useMemo, useSyncExternalStore } from "react";

import { isEditKey, isEventCode } from "./event-code";
import { cleanText, EVENT_LIMITS } from "./event-schema";

/**
 * What this browser remembers about events, in `localStorage`: the events
 * it can edit (code plus edit key, so the organizer can come back without
 * digging up the link) and the scorer's display name.
 *
 * An edit key is a capability, like a map session's host id: anyone who
 * reads it can edit that event. It's kept here because losing it would lock
 * the organizer out of their own event, and "Forget" removes it. Read via
 * `useSyncExternalStore` with an in-memory fallback, like the modifier
 * planner's picks, so it still works for the visit when storage is blocked.
 */

const MY_EVENTS_KEY = "tarkovguides.events.mine.v1";
const SCORER_NAME_KEY = "tarkovguides.events.scorer-name";
const PARTICIPANT_ID_KEY = "tarkovguides.events.participant-id";

/** The most events remembered; the oldest drop off first. */
const MAX_REMEMBERED = 50;

/** An event this browser can edit. */
export interface RememberedEvent {
  code: string;
  editKey: string;
  /** The event's name when last seen, for the list. */
  name: string;
  savedAt: number;
}

const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function readRaw(key: string): string {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeRaw(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the in-memory copy covers this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key) memory.delete(event.key);
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Parses the stored list, dropping anything malformed. Newest first. */
export function parseRememberedEvents(raw: string): RememberedEvent[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const events: RememberedEvent[] = [];
    for (const value of parsed) {
      if (typeof value !== "object" || value === null) continue;
      const { code, editKey, name, savedAt } = value as Record<string, unknown>;
      if (!isEventCode(code) || !isEditKey(editKey) || seen.has(code)) continue;
      seen.add(code);
      events.push({
        code,
        editKey,
        name: cleanText(name, EVENT_LIMITS.eventName) || "Untitled event",
        savedAt: typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : 0,
      });
    }
    return events.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function readRemembered(): RememberedEvent[] {
  return parseRememberedEvents(readRaw(MY_EVENTS_KEY));
}

/**
 * Adds or refreshes an event in the list, moving it to the top. An empty
 * `name` keeps the name already remembered for that code (opening an edit
 * link knows the key before it knows the event's name).
 */
export function rememberEvent(event: Omit<RememberedEvent, "savedAt">, now = Date.now()): void {
  const events = readRemembered();
  const known = events.find((existing) => existing.code === event.code);
  const name = event.name !== "" ? event.name : (known?.name ?? "Untitled event");
  const others = events.filter((existing) => existing.code !== event.code);
  const next = [{ ...event, name, savedAt: now }, ...others].slice(0, MAX_REMEMBERED);
  writeRaw(MY_EVENTS_KEY, JSON.stringify(next));
}

/** Updates the remembered name of an event, if it's in the list. */
export function renameRememberedEvent(code: string, name: string): void {
  const events = readRemembered();
  const target = events.find((event) => event.code === code);
  if (!target || target.name === name) return;
  writeRaw(
    MY_EVENTS_KEY,
    JSON.stringify(events.map((event) => (event.code === code ? { ...event, name } : event))),
  );
}

/** Removes an event (and its edit key) from this browser. The event itself is untouched. */
export function forgetEvent(code: string): void {
  writeRaw(MY_EVENTS_KEY, JSON.stringify(readRemembered().filter((event) => event.code !== code)));
}

/** The events this browser can edit, newest first. */
export function useRememberedEvents(): readonly RememberedEvent[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(MY_EVENTS_KEY),
    () => "",
  );
  return useMemo(() => parseRememberedEvents(raw), [raw]);
}

/** The edit key this browser holds for `code`, or `null`. */
export function useRememberedEditKey(code: string): string | null {
  const events = useRememberedEvents();
  return events.find((event) => event.code === code)?.editKey ?? null;
}

/** The scorer's display name ("" until they set one). */
export function useScorerName(): string {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(SCORER_NAME_KEY),
    () => "",
  );
  return cleanText(raw, EVENT_LIMITS.scorerName);
}

/** Saves the scorer's display name. */
export function saveScorerName(name: string): void {
  writeRaw(SCORER_NAME_KEY, cleanText(name, EVENT_LIMITS.scorerName));
}

/** A stable random id for this browser, sent when connecting to an event room (Liveblocks counts users by it). */
export function getEventParticipantId(): string {
  const existing = readRaw(PARTICIPANT_ID_KEY);
  if (/^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  writeRaw(PARTICIPANT_ID_KEY, id);
  return id;
}
