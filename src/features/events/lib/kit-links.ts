import { eventViewPath } from "./event-code";
import { parseKit, parsePreset } from "./preset-schema";
import { hashParams, packForLink, unpackFromLink } from "./share-codec";

import type { Kit, Preset } from "../types";

/**
 * Links for the kit checker. The kit (and, for a standalone check, the
 * preset) ride in the URL fragment, packed by `share-codec.ts`, so a link
 * carries everything and nothing is stored server side.
 */

/** The kit checker for one of an event's role presets. */
export function eventKitPath(code: string, roleId: string): string {
  return `${eventViewPath(code)}/kit?role=${encodeURIComponent(roleId)}`;
}

/** The standalone kit checker, for a preset that isn't part of an event. */
export const STANDALONE_KIT_PATH = "/resources/events/kit";

/** The fragment for a kit, with the preset too when it isn't from an event. */
export async function kitHash(kit: Kit, preset?: Preset): Promise<string> {
  const params = new URLSearchParams();
  if (preset) params.set("p", await packForLink(preset));
  const hasKit = Object.keys(kit.slots).length > 0 || kit.carried.length > 0;
  if (hasKit) params.set("k", await packForLink(kit));
  const text = params.toString();
  return text ? `#${text}` : "";
}

/** Reads the kit from a fragment, or `null` when there isn't a readable one. */
export async function kitFromHash(hash: string): Promise<Kit | null> {
  const packed = hashParams(hash).get("k");
  if (!packed) return null;
  const value = await unpackFromLink(packed);
  return value === null ? null : parseKit(value);
}

/** Reads a standalone preset from a fragment, or `null`. */
export async function presetFromHash(hash: string): Promise<Preset | null> {
  const packed = hashParams(hash).get("p");
  if (!packed) return null;
  return parsePreset(await unpackFromLink(packed));
}
