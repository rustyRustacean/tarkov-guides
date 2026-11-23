import { useMemo, useSyncExternalStore } from "react";

import { parsePreset } from "./preset-schema";

import type { Preset } from "../types";

/**
 * "My presets": presets kept in this browser for reuse across events. Only
 * ever local; nothing here is published anywhere unless the user publishes
 * it themselves (Stage 3's public library). Same storage pattern as "Your
 * events": `useSyncExternalStore` over `localStorage`, an in-memory
 * fallback, and validation on read.
 */

const KEY = "tarkovguides.events.presets.v1";

/** The most presets kept. */
export const MAX_MY_PRESETS = 50;

const listeners = new Set<() => void>();
let memory: string | null = null;

function readRaw(): string {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function writeRaw(value: string): void {
  memory = value;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Storage blocked: the in-memory copy covers this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) memory = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Parses the stored list, dropping malformed presets and duplicate ids. */
export function parseMyPresets(raw: string): Preset[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: Preset[] = [];
    for (const value of parsed) {
      const preset = parsePreset(value);
      if (!preset || seen.has(preset.id)) continue;
      seen.add(preset.id);
      out.push(preset);
    }
    return out.slice(0, MAX_MY_PRESETS);
  } catch {
    return [];
  }
}

/** Adds a preset, or replaces the one with the same id (keeping its place in the list). */
export function saveMyPreset(preset: Preset): void {
  const presets = parseMyPresets(readRaw());
  const at = presets.findIndex((existing) => existing.id === preset.id);
  if (at === -1) presets.unshift(preset);
  else presets[at] = preset;
  writeRaw(JSON.stringify(presets.slice(0, MAX_MY_PRESETS)));
}

/** Removes a preset from this browser. */
export function deleteMyPreset(id: string): void {
  writeRaw(JSON.stringify(parseMyPresets(readRaw()).filter((preset) => preset.id !== id)));
}

/** The presets kept in this browser. */
export function useMyPresets(): readonly Preset[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return useMemo(() => parseMyPresets(raw), [raw]);
}
