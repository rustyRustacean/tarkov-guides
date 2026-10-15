import { useExitSnipStore } from "@/features/maps/exit-snip-store";
import {
  describeOutcome,
  matchExitSnip,
  type ExitSnipOutcome,
  type ExitSnipRow,
} from "@/features/maps/lib/exit-snip";
import { confirmSnip } from "@/features/player-lookup/use-killer-lookup";
import { toast } from "@/shared/ui/toast/toast-store";

import {
  COMPANION_PORTS,
  COMPANION_REQUEST_TIMEOUT_MS,
  type CompanionStatus,
} from "./companion-config";

import type { RawMap } from "@/shared/lib/tarkov-api/types";

/** What the companion's `GET /exits` returns. */
interface ExitsPayload {
  ok?: boolean;
  /** `exit-list` (rows attached, snip saved), `other` (not an exit list, nothing kept) or `error`. */
  kind?: string;
  rows?: unknown;
  snipId?: string | null;
  error?: string | null;
}

/** Whether the snip was an exit list the watcher dealt with, or something else (let the next handler look). */
export type ExitSnipHandling = "handled" | "other";

function isRow(value: unknown): value is ExitSnipRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    (row.kind === "exfil" || row.kind === "transit") &&
    typeof row.name === "string" &&
    typeof row.hasTimer === "boolean" &&
    (row.index === null || typeof row.index === "number")
  );
}

/** Ask each known port for the clipboard's exit list until one answers. */
async function readExits(): Promise<{ payload: ExitsPayload; port: number } | null> {
  for (const port of COMPANION_PORTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, COMPANION_REQUEST_TIMEOUT_MS * 10); // OCR + a pixel pass is slower than a poll
      const response = await fetch(`http://127.0.0.1:${String(port)}/exits`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      return { payload: (await response.json()) as ExitsPayload, port };
    } catch {
      // Not this port - try the next.
    }
  }
  return null;
}

/**
 * One full run for a fresh clipboard image seen while in a raid.
 *
 * Applies the snip only when it is the exit list AND its names fit the map
 * the game says the player is on; otherwise changes nothing and says why. The
 * snip file is only ever reported "used" (which is what lets the companion
 * delete it) when exits were actually put on the map.
 */
export async function handleExitSnip(
  status: CompanionStatus,
  maps: readonly RawMap[],
): Promise<ExitSnipHandling> {
  // An older companion has no /exits: stay out of its way.
  if (!(status.capabilities ?? []).includes("exitSnip")) return "other";

  const read = await readExits();
  if (read === null) {
    toast({ message: "Couldn't reach the companion to read that snip - is it still running?" });
    return "handled";
  }
  const { payload, port } = read;

  if (payload.ok === false || payload.kind === "error") {
    toast({ message: payload.error ?? "Couldn't read that snip." });
    return "handled";
  }
  if (payload.kind !== "exit-list") return "other";

  const rows = Array.isArray(payload.rows) ? payload.rows.filter(isRow) : [];
  const snipId = payload.snipId ?? null;

  if (maps.length === 0) {
    // The game data is still loading: kept, not consumed, so a retry works.
    toast({ message: "Map data is still loading - snip the exit list again in a moment." });
    if (snipId !== null) await confirmSnip(port, snipId, false);
    return "handled";
  }

  const outcome: ExitSnipOutcome = matchExitSnip(rows, status.raidLocation, maps);

  if (outcome.status === "refused") {
    toast({ message: outcome.message, durationMs: 10_000 });
    // Reported unmatched so the companion KEEPS the snip.
    if (snipId !== null) await confirmSnip(port, snipId, false);
    return "handled";
  }

  const store = useExitSnipStore.getState();
  store.apply({
    nameId: outcome.nameId,
    side: outcome.side,
    exits: outcome.exits,
    appliedAt: Date.now(),
  });
  toast({
    message: describeOutcome(outcome),
    action: {
      label: "UNDO",
      onClick: () => {
        useExitSnipStore.getState().clear();
      },
    },
    durationMs: 12_000,
  });
  // Only now is the snip "used": this is what allows the companion to remove
  // that one file (and only it, by the id it issued).
  if (snipId !== null) await confirmSnip(port, snipId, outcome.exits.length > 0);
  return "handled";
}
