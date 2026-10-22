"use client";

import { useEffect, useMemo, useRef } from "react";

import { useExitPathStore } from "@/features/maps/exit-path-store";
import { useExitSnipStore } from "@/features/maps/exit-snip-store";
import { fromMapData } from "@/features/maps/hooks/use-exit-path";
import { exitKey } from "@/features/maps/lib/exit-path";
import { rotateExit } from "@/features/maps/lib/exit-rotate";
import { tabForRaidLocation } from "@/features/maps/lib/raid-location";
import { useMapsStore } from "@/features/maps/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { toast } from "@/shared/ui/toast/toast-store";

import { COMPANION_PORTS, type CompanionStatus } from "./companion-config";
import { useExitSnipPreference } from "./use-companion";

import type { AppliedExit } from "@/features/maps/lib/exit-snip";
import type { RawMap } from "@/shared/lib/tarkov-api/types";

/** How often the site re-asks for the keys; the companion drops them after 20 s of silence. */
const KEEPALIVE_MS = 5000;

/** Ask the companion to hold (or drop) the exit keys; tries each known port. */
async function sendKeys(on: boolean): Promise<void> {
  for (const port of COMPANION_PORTS) {
    try {
      const response = await fetch(`http://127.0.0.1:${String(port)}/keys?on=${on ? "1" : "0"}`, {
        cache: "no-store",
      });
      if (response.ok) return;
    } catch {
      // Not this port: try the next.
    }
  }
}

/**
 * The exits the keys cycle through: the raid's map when there is one (the
 * applied exit list if it was read there, else every exit the map data has),
 * otherwise the map tab open on the site, so the keys also work in the menus.
 */
function exitsFor(
  raidLocation: string | null,
  maps: readonly RawMap[],
  openTab: string,
): readonly AppliedExit[] {
  const raidTab = tabForRaidLocation(raidLocation, maps);
  const snip = useExitSnipStore.getState().snip;
  if (raidTab !== null && snip !== null && tabForRaidLocation(snip.nameId, maps) === raidTab) {
    return snip.exits;
  }
  const tab = raidTab ?? openTab;
  const map = maps.find((candidate) => candidate.normalizedName === tab);
  return map ? fromMapData(map) : [];
}

/** Step the selected exit of one kind `steps` times (sign is the direction). */
function stepExit(kind: "exfil" | "transit", steps: number, exits: readonly AppliedExit[]): void {
  const direction = steps > 0 ? 1 : -1;
  let key = useExitPathStore.getState().selectedKey;
  let chosen: AppliedExit | null = null;
  for (let i = 0; i < Math.abs(steps); i += 1) {
    chosen = rotateExit(exits, key, kind, direction);
    if (chosen === null) break;
    key = exitKey(chosen);
  }
  if (chosen === null || key === null) {
    toast({
      message:
        kind === "exfil" ? "No extracts known for this map." : "No transits known for this map.",
    });
    return;
  }
  useExitPathStore.getState().setSelected(key);
  toast({ message: `Going to: ${chosen.name}`, durationMs: 2500 });
}

/** Left and Right together: turn Go to Exit on, leading to the selected (or closest) exit. */
function startPath(): void {
  useExitPathStore.getState().setPathOn(true);
  toast({ message: "Path to exit on.", durationMs: 2000 });
}

/**
 * Left/Right and Up/Down arrows move the selected exit (exfils / transits)
 * while the game has focus. The companion holds the arrows only while EFT is
 * the foreground window, and only while this option is on and this page keeps
 * asking (an OS hotkey: nothing hooked or injected).
 *
 * Left and Right pressed together start the path to the selected exit. The
 * companion waits a moment on a lone Left/Right so a slightly mistimed chord
 * does not rotate first.
 *
 * Works any time the game is focused: in a raid it cycles that raid's exits
 * (the applied exit list if there is one, else the map's own), and outside a
 * raid the map tab that is open. Tied to the "Exit list from snip" option: no extra
 * setting, no rebinding.
 */
export function useExitKeys(status: CompanionStatus | null): void {
  const [enabled] = useExitSnipPreference();
  const supported = status?.capabilities?.includes("exitKeys") === true;
  const active = enabled && supported;
  const { data } = useTarkovGameData();
  const maps = useMemo<readonly RawMap[]>(() => data?.maps ?? [], [data]);
  const raidLocation = status?.raidLocation ?? null;

  useEffect(() => {
    if (!active) return;
    void sendKeys(true);
    const timer = window.setInterval(() => {
      void sendKeys(true);
    }, KEEPALIVE_MS);
    return () => {
      window.clearInterval(timer);
      void sendKeys(false);
    };
  }, [active]);

  const lastRef = useRef<{ exit: number; transit: number; chord: number } | null>(null);
  const keys = status?.exitKeys;
  const exitCount = keys?.exit;
  const transitCount = keys?.transit;
  const chordCount = keys?.chord ?? 0;
  const keysOn = keys?.on === true;

  useEffect(() => {
    if (!active || !keysOn || exitCount === undefined || transitCount === undefined) {
      // Counters restart with the companion: never diff across a gap.
      lastRef.current = null;
      return;
    }
    const last = lastRef.current;
    lastRef.current = { exit: exitCount, transit: transitCount, chord: chordCount };
    if (last === null) return;
    if (chordCount !== last.chord) startPath();
    const exits = exitsFor(raidLocation, maps, useMapsStore.getState().currentMap);
    if (exitCount !== last.exit) stepExit("exfil", exitCount - last.exit, exits);
    if (transitCount !== last.transit) stepExit("transit", transitCount - last.transit, exits);
  }, [active, keysOn, exitCount, transitCount, chordCount, raidLocation, maps]);
}
