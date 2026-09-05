"use client";

import { useEffect, useRef } from "react";

import {
  companionBaseMode,
  COMPANION_PORTS,
  COMPANION_REQUEST_TIMEOUT_MS,
  type CompanionMode,
  type CompanionStatus,
} from "@/features/companion/companion-config";
import { useKillerLookupPreference } from "@/features/companion/use-companion";
import { toast } from "@/shared/ui/toast/toast-store";

/**
 * The profile-search watcher (the "Profile search (Win+Shift+S)" checkbox in
 * the companion panel): snip a player's name - the killer on the raid-end
 * screen, or anyone's name anywhere - and their tarkov.dev stats page opens.
 * No page and no button of its own.
 *
 * How it notices a snip without watching the clipboard: the companion's
 * `/status` (polled anyway) carries `clipSeq`, Windows' clipboard CHANGE
 * COUNTER - a number that says the clipboard changed, never what's on it.
 * When the counter moves while the option is on, ONE `/snip` call is made;
 * that is the only thing that ever reads (and saves) the clipboard image.
 * The OCR lives in the companion because the clipboard is on the player's
 * machine; the name -> account id step runs on this origin because it needs
 * tarkov.dev's ~67 MB player index (see api/player-lookup).
 */

/** What the companion's `GET /snip` returns after OCRing the clipboard. */
export interface SnipResult {
  ok: boolean;
  nickname: string | null;
  /** True when the name is a two-word AI scav, which has no profile. */
  isAi: boolean;
  /** Full path of the saved snip image. */
  savedTo: string | null;
  /** Handle for reporting back whether this snip produced a profile. */
  snipId: string | null;
  error: string | null;
}

/**
 * tarkov.dev's own game-mode slugs, taken from the toggle on their player
 * page (`ToggleButton value=` in tarkov-dev/src/pages/player/index.jsx):
 * `regular`, `pve`, `pvp-season`, `arena`. A profile's stats differ per mode,
 * so opening the wrong one shows the wrong numbers - a seasonal character's
 * kills are not in their `regular` tab.
 *
 * Mapped from what the companion reports you are PLAYING, so the killer's
 * page lands on the tab matching the raid you just died in.
 *
 * `pve_season` has no tab of its own on their site (the seasonal toggle is
 * PvP-only), so it falls back to `pve` - the real mode it's a season of.
 *
 * When the mode is UNKNOWN - the companion hasn't seen a raid yet this
 * session, is too old to report it, or the game wrote something new - the
 * fallback is the SEASON tab, on the user's instruction: during a season
 * that's what they're playing, so it's the likeliest right answer. The tab
 * toggle on tarkov.dev's own page is one click away if it guesses wrong.
 */
const TARKOV_DEV_GAME_MODES: Record<CompanionMode, string> = {
  pvp: "regular",
  pve: "pve",
  pvp_season: "pvp-season",
  pve_season: "pve",
};

const TARKOV_DEV_FALLBACK_MODE = "pvp-season";

/** tarkov.dev's slug for the mode being played (see the table above). */
export function tarkovDevGameMode(mode: CompanionMode | null): string {
  return mode === null ? TARKOV_DEV_FALLBACK_MODE : TARKOV_DEV_GAME_MODES[mode];
}

/** The tarkov.dev stats page for an account, on the mode you're playing. */
export function tarkovDevPlayerUrl(accountId: string, mode: CompanionMode | null): string {
  return `https://tarkov.dev/players/${tarkovDevGameMode(mode)}/${accountId}`;
}

/**
 * Whether a new `clipSeq` observation should fire a snip read.
 *
 * The first observation after enabling (or after the companion reappears) is
 * a BASELINE, never a trigger - whatever was on the clipboard when the option
 * came on predates it. A missing counter (companion older than 2.7.0) never
 * fires. Kept pure so the rule is testable without the polling machinery.
 */
export function shouldTriggerSnip(
  previous: number | null,
  next: number | undefined,
): { baseline: number | null; fire: boolean } {
  if (next === undefined) return { baseline: null, fire: false };
  if (previous === null) return { baseline: next, fire: false };
  return { baseline: next, fire: next !== previous };
}

/**
 * Report back whether a snip produced a real profile, and return whether the
 * companion consequently removed it.
 *
 * `matched=1` is a request, not an instruction: the companion still requires
 * the id to be one it issued and Tarkov to have been running when the snip
 * was taken. A failure here is deliberately swallowed - not hearing back just
 * means the snip is kept, which is the harmless outcome.
 */
async function confirmSnip(port: number, snipId: string, matched: boolean): Promise<void> {
  try {
    await fetch(
      `http://127.0.0.1:${String(port)}/snip/confirm?id=${encodeURIComponent(snipId)}&matched=${matched ? "1" : "0"}`,
      { cache: "no-store" },
    );
  } catch {
    // Companion gone mid-flow: the snip is kept.
  }
}

/** Ask each known port for a snip until one answers; null when none does. */
async function readSnip(): Promise<{ snip: SnipResult; port: number } | null> {
  for (const port of COMPANION_PORTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, COMPANION_REQUEST_TIMEOUT_MS * 8); // OCR is slower than a status poll
      const response = await fetch(`http://127.0.0.1:${String(port)}/snip`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      return { snip: (await response.json()) as SnipResult, port };
    } catch {
      // Not this port - try the next.
    }
  }
  return null;
}

/**
 * Ask the companion to open the profile through Windows. Returns whether it
 * did.
 *
 * This is the primary path, and the only one that reliably works: the tab is
 * opened from a background clipboard check with no click behind it, which
 * every popup blocker refuses. Windows opening the default browser isn't a
 * popup at all. The companion takes an account id and builds the tarkov.dev
 * address itself - it accepts no URL, so this cannot become "open anything".
 */
export function openProfileRequestUrl(
  port: number,
  accountId: string,
  mode: CompanionMode | null,
): string {
  return `http://127.0.0.1:${String(port)}/open-profile?id=${encodeURIComponent(accountId)}&mode=${tarkovDevGameMode(mode)}`;
}

async function openViaCompanion(
  port: number,
  accountId: string,
  mode: CompanionMode | null,
): Promise<boolean> {
  try {
    const response = await fetch(openProfileRequestUrl(port, accountId, mode), {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}

/**
 * Fallback for a companion too old to open it (pre-2.7.1) or one that failed
 * to: try the browser, and when the blocker refuses, hand the link to a toast
 * - clicking THAT is a user gesture no blocker argues with. The toast lingers
 * well past the default because the player is usually still alt-tabbing over
 * from the game.
 */
function openStatsPage(nickname: string, url: string): void {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened !== null) return;
  toast({
    message: `${nickname} found`,
    action: {
      label: "OPEN STATS",
      onClick: () => {
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    durationMs: 15_000,
  });
}

/** One full run: read the snip, resolve the name, open the page. */
async function lookUpFreshSnip(mode: CompanionMode | null): Promise<void> {
  const read = await readSnip();
  if (read === null) {
    // The counter moved, so a companion WAS answering a moment ago - staying
    // silent here leaves someone staring at a snip that did nothing. It has
    // either quit (it idles out after ten minutes) or the browser is refusing
    // to reach it, which is the blocked-Apps setting the FAQ covers.
    toast({ message: "Couldn't reach the companion to read that snip - is it still running?" });
    return;
  }
  const { snip, port } = read;

  if (!snip.ok || snip.nickname === null) {
    // A clipboard change with no image on it is ordinary copying, not a
    // failed snip - stay quiet. Anything else is a real snip that couldn't
    // be read, and silence there would look like the feature is broken.
    if (snip.error?.includes("no image") ?? false) return;
    toast({ message: snip.error ?? "Couldn't read that snip." });
    return;
  }

  if (snip.isAi) {
    toast({ message: `${snip.nickname} is an AI scav - no profile to open.` });
    return;
  }

  const base = mode !== null ? companionBaseMode(mode) : "pvp";
  try {
    const response = await fetch(
      `/api/player-lookup?name=${encodeURIComponent(snip.nickname)}&mode=${base}`,
    );
    const payload = (await response.json()) as { found?: boolean; accountId?: string };
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);

    const accountId = payload.found === true ? (payload.accountId ?? null) : null;
    if (snip.snipId !== null) await confirmSnip(port, snip.snipId, accountId !== null);
    if (accountId === null) {
      // A miss is normal - the index covers most players, not all of them.
      toast({ message: `${snip.nickname} isn't in tarkov.dev's player index.` });
      return;
    }
    // Companion first (never blocked), browser only if it couldn't.
    if (await openViaCompanion(port, accountId, mode)) return;
    openStatsPage(snip.nickname, tarkovDevPlayerUrl(accountId, mode));
  } catch {
    toast({ message: `Read "${snip.nickname}" but the lookup failed - try again.` });
  }
}

/**
 * Watch the polled status for a fresh snip while the option is on.
 *
 * Mounted by `CompanionButton` (site-wide via the header), which also feeds
 * the option into the poll gate - so enabling the checkbox is what keeps the
 * status flowing for this to watch.
 */
export function useKillerSnipWatcher(status: CompanionStatus | null): void {
  const [enabled] = useKillerLookupPreference();
  const lastSeqRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || status === null) {
      // Re-baseline on re-enable/reconnect: the counter's value from before
      // the gap describes clipboard changes this option wasn't on for.
      lastSeqRef.current = null;
      return;
    }
    const { baseline, fire } = shouldTriggerSnip(lastSeqRef.current, status.clipSeq);
    lastSeqRef.current = baseline;
    if (!fire || busyRef.current) return;

    busyRef.current = true;
    void lookUpFreshSnip(status.mode).finally(() => {
      busyRef.current = false;
    });
  }, [enabled, status]);
}
