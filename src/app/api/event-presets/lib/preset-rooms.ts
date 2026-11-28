import "server-only";

import { NextResponse } from "next/server";

import { blockedFieldMessage, findBlockedPresetText } from "@/features/events/lib/moderation";
import { parsePreset } from "@/features/events/lib/preset-schema";
import {
  isPublicPresetId,
  sortPublicPresets,
  type PublicPresetSummary,
} from "@/features/events/lib/public-presets";

import { getRoomOfKind, isRoomNotFound, secretKeyMatches } from "../../events/lib/event-keys";
import { NO_STORE } from "../../lib/cache-headers";
import { readJsonObject } from "../../lib/read-json";

import type { Preset } from "@/features/events/types";
import type { Liveblocks, RoomData } from "@liveblocks/node";

/**
 * Server side of the public preset library. Each published preset is one
 * Liveblocks room, `preset:<id>`, created with no default access and never
 * given a client token, so only these routes read or write it.
 *
 * Room metadata carries what the list needs (so listing is one metadata
 * query, no storage reads): `kind: "preset"`, `status` (`listed` or
 * `hidden`), `manageKeyHash`, `name`, `rules` (count), `uses` (count),
 * `publishedAt`, `updatedAt`. Storage holds only `{ version, preset }`, so
 * a read stays the size of the preset however popular it gets.
 */

const ROOM_PREFIX = "preset:";

/**
 * The most rooms the list reads (20 pages of Liveblocks' maximum 100).
 * Liveblocks can't sort by metadata and returns newest first, so past this
 * the oldest presets drop off however popular they are. A known limit, far
 * beyond the library's size; past it the ranking would need its own index.
 */
const MAX_LISTED = 2000;

/** A preset is at most a few KB; this leaves room for long notes on every rule. */
const MAX_BODY_BYTES = 64_000;

/** A published preset's Liveblocks room id. */
export function presetRoomId(id: string): string {
  return `${ROOM_PREFIX}${id}`;
}

/** Whether a published preset shows in the library. */
export type PresetStatus = "listed" | "hidden";

/** The room's status, or `null` when the metadata isn't a public preset's. */
export function presetStatus(metadata: RoomData["metadata"]): PresetStatus | null {
  if (metadata.kind !== "preset") return null;
  return metadata.status === "listed" || metadata.status === "hidden" ? metadata.status : null;
}

function count(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/** The list entry for a preset room, or `null` when the room isn't a well-formed one. */
export function readSummary(room: RoomData): PublicPresetSummary | null {
  const id = room.id.startsWith(ROOM_PREFIX) ? room.id.slice(ROOM_PREFIX.length) : "";
  const { name, publishedAt } = room.metadata;
  if (!isPublicPresetId(id) || presetStatus(room.metadata) === null) return null;
  if (typeof name !== "string" || !name) return null;
  const published = typeof publishedAt === "string" ? Date.parse(publishedAt) : NaN;
  return {
    id,
    name,
    uses: count(room.metadata.uses),
    rules: count(room.metadata.rules),
    publishedAt: Number.isFinite(published) ? published : 0,
  };
}

/** Every listed preset, most used first. */
export async function listPublicPresets(liveblocks: Liveblocks): Promise<PublicPresetSummary[]> {
  const summaries: PublicPresetSummary[] = [];
  let read = 0;
  for await (const room of liveblocks.iterRooms(
    { query: { metadata: { kind: "preset", status: "listed" } } },
    { pageSize: 100 },
  )) {
    const summary = readSummary(room);
    // The query already filters on status; checked again so a hidden preset can never slip in.
    if (summary && presetStatus(room.metadata) === "listed") summaries.push(summary);
    if (++read >= MAX_LISTED) break;
  }
  return sortPublicPresets(summaries);
}

/** The room, when it's a public preset's; `null` when there's no such preset. */
export async function getPresetRoom(liveblocks: Liveblocks, id: string): Promise<RoomData | null> {
  const room = await getRoomOfKind(liveblocks, presetRoomId(id), "preset");
  return room && presetStatus(room.metadata) !== null ? room : null;
}

/** Outcome of {@link verifyManageKey}. */
export type ManageCheck =
  { result: "ok"; room: RoomData } | { result: "not-found" } | { result: "forbidden" };

/** Checks an owner's manage key against the preset room's stored hash. */
export async function verifyManageKey(
  liveblocks: Liveblocks,
  id: string,
  manageKey: string,
): Promise<ManageCheck> {
  const room = await getPresetRoom(liveblocks, id);
  if (!room) return { result: "not-found" };
  return secretKeyMatches(manageKey, room.metadata.manageKeyHash)
    ? { result: "ok", room }
    : { result: "forbidden" };
}

/** The published preset itself, re-validated; `null` when the room is gone or holds nothing usable. */
export async function readPublishedPreset(
  liveblocks: Liveblocks,
  id: string,
): Promise<Preset | null> {
  let storage: unknown;
  try {
    storage = await liveblocks.getStorageDocument(presetRoomId(id), "json");
  } catch (error) {
    if (isRoomNotFound(error)) return null;
    throw error;
  }
  const raw =
    typeof storage === "object" && storage !== null
      ? (storage as { preset?: unknown }).preset
      : null;
  const preset = parsePreset(raw);
  return preset ? { ...preset, id } : null;
}

/** Why a preset can't be published, ready to send back. */
export interface PresetRejection {
  status: 400 | 422;
  error: string;
  reason: string;
  /** For `blocked-text`: which field, and the rule when it's a note. */
  field?: string;
  ruleId?: string;
}

/** Outcome of {@link preparePresetForPublishing}. */
export type PreparedPreset =
  { ok: true; preset: Preset } | { ok: false; rejection: PresetRejection };

/** The error response for a rejected preset. */
export function rejectionResponse({ status, error, reason, ...extra }: PresetRejection) {
  return presetError(status, error, reason, extra);
}

/**
 * Validates and cleans a preset someone wants to publish or update: the
 * same `parsePreset` every reader runs, at least one rule, and the
 * profanity filter over every text field. The result carries the public id.
 */
export function preparePresetForPublishing(raw: unknown, id: string): PreparedPreset {
  // The public id replaces the owner's local one before parsing, so a local id
  // `parsePreset` wouldn't accept can't fail the whole preset.
  const preset = parsePreset(typeof raw === "object" && raw !== null ? { ...raw, id } : raw);
  if (!preset) {
    return {
      ok: false,
      rejection: { status: 400, error: "invalid-preset", reason: "The preset needs a name." },
    };
  }
  if (preset.rules.length === 0) {
    return {
      ok: false,
      rejection: {
        status: 400,
        error: "no-rules",
        reason: "Add at least one rule before publishing.",
      },
    };
  }
  const blocked = findBlockedPresetText(preset);
  if (blocked) {
    return {
      ok: false,
      rejection: {
        status: 422,
        error: "blocked-text",
        reason: blockedFieldMessage(blocked),
        ...blocked,
      },
    };
  }
  return { ok: true, preset };
}

/** Metadata that follows the preset's content: its name and rule count. */
export function contentMetadata(preset: Preset, now: Date): Record<string, string> {
  return { name: preset.name, rules: String(preset.rules.length), updatedAt: now.toISOString() };
}

/** A JSON error that's never cached. */
export function presetError(
  status: number,
  error: string,
  reason: string,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json({ ...extra, error, reason }, { status, headers: NO_STORE });
}

/** The 404 for a preset that doesn't exist, was unpublished, or is hidden from the public. */
export function notFound(): NextResponse {
  return presetError(404, "not-found", "This preset isn't in the library.");
}

/** The response for a failed Liveblocks call: a 404 when the room is gone (e.g. deleted mid-request), else a 500. */
export function failureResponse(error: unknown): NextResponse {
  return isRoomNotFound(error)
    ? notFound()
    : presetError(500, "server-error", "The preset library is unavailable right now.");
}

/** A preset route's JSON body, or the 413 or 400 to send instead. */
export async function readPresetBody(
  request: Request,
): Promise<Record<string, unknown> | NextResponse> {
  const body = await readJsonObject(request, MAX_BODY_BYTES);
  if (body === "too-large") return presetError(413, "too-large", "That preset is too large.");
  return body ?? presetError(400, "invalid-input", "Malformed request body.");
}
