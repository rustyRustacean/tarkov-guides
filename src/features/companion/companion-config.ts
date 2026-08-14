/**
 * The MasterTarkov Companion is a small local program the user installs once.
 * It reads the Escape from Tarkov log files and exposes the active profile,
 * game mode, and quest state on a localhost port that this site polls. The
 * companion never touches the game process, memory, or files: it only reads
 * logs EFT already wrote to disk.
 */

export const COMPANION_PORT = 47800;
/**
 * Ports to look on, in order. The companion prefers the first but steps to
 * the next when an unrelated program already holds it. Without probing the
 * same short list here, that machine would show "Not running" forever with
 * the companion working perfectly one port over.
 *
 * Kept to four: every entry is a request made on machines that may not have
 * the companion at all, and the first one succeeds in the normal case.
 */
export const COMPANION_PORTS = [COMPANION_PORT, 47801, 47802, 47803] as const;
export const COMPANION_BASE_URL = `http://127.0.0.1:${String(COMPANION_PORT)}`;
export const COMPANION_STATUS_URL = `${COMPANION_BASE_URL}/status`;
export const companionStatusUrl = (port: number) => `http://127.0.0.1:${String(port)}/status`;
/**
 * The companion's own plain-text "why isn't this connecting" page.
 *
 * Opened directly in a tab rather than fetched: a blocked origin and a dead
 * port both surface here as an identical failed `fetch`, so this page can
 * never distinguish them. A direct navigation isn't cross-origin, though, so
 * the companion can answer and name the address it refused.
 */
export const COMPANION_DIAGNOSTIC_URL = `${COMPANION_BASE_URL}/diag`;

/** Custom URL protocol registered by the companion's setup, used to start it on demand. */
export const COMPANION_PROTOCOL = "masttarkov";
export const COMPANION_LAUNCH_URL = `${COMPANION_PROTOCOL}://launch`;

/**
 * A zip of four plain-text files: the companion script, an installer, an
 * uninstaller, and a readme. Served from `public/`, rebuilt by
 * `scripts/build-companion-zip.ps1`.
 *
 * This replaced a single self-installing .exe. That executable worked, but
 * it was unsigned with no reputation, so every new user hit a SmartScreen
 * block, and on one machine Defender quarantined it minutes after install,
 * scoring the self-copy plus autostart plus listening socket as a
 * persistence pattern. There is no free fix for that; the signing
 * certificate is the fix.
 *
 * Text sidesteps the whole problem: nothing is compiled, so there's nothing
 * to be suspicious of and nothing to sign, and the user can read every line
 * before running it, which a 7MB binary never could. Windows PowerShell is
 * already on the machine, so there's still nothing to download but this.
 */
export const COMPANION_DOWNLOAD_URL = "/companion/MasterTarkovCompanion.zip";
/**
 * The companion script, served as `text/plain` so it opens in the tab.
 *
 * A route rather than the `public/` file directly: static hosting serves a
 * `.ps1` as `application/octet-stream`, which downloads it instead of
 * showing it, the opposite of the point. The route reads the same file the
 * zip is built from, so there is no second copy to drift.
 */
export const COMPANION_SOURCE_URL = "/companion/source";
/** Pasted into a terminal opened in the extracted folder. */
export const COMPANION_INSTALL_COMMAND =
  "powershell -NoProfile -ExecutionPolicy Bypass -File .\\install.ps1";
export const COMPANION_UNINSTALL_COMMAND =
  "powershell -NoProfile -ExecutionPolicy Bypass -File .\\uninstall.ps1";

export const COMPANION_POLL_INTERVAL_MS = 5000;
/** A localhost request should answer near-instantly; give up quickly if it doesn't. */
export const COMPANION_REQUEST_TIMEOUT_MS = 1500;

/** localStorage key: whether to auto-start the companion when the site loads. */
export const COMPANION_AUTOLAUNCH_KEY = "tg.companion.autolaunch";
/** localStorage key: whether to auto-match/create the tracker profile from the game. */
export const COMPANION_PROFILE_SYNC_KEY = "tg.companion.profilesync";
/** localStorage key: JSON map of the game's profile id -> tracker profile id. */
export const COMPANION_PROFILE_MAP_KEY = "tg.companion.profilemap";
/**
 * localStorage key: has the companion ever actually answered on this machine?
 *
 * Gates the auto-launch protocol hand-off. Firing `masttarkov://` on a
 * machine with no handler registered is not the silent no-op it was assumed
 * to be: Chromium shows an OS-level "Get an app to open this link" dialog,
 * so every visitor who never installed the companion got a Microsoft Store
 * popup on page load. Only machines that have had a working companion at
 * least once may fire it.
 */
export const COMPANION_EVER_CONNECTED_KEY = "tg.companion.everconnected";
/**
 * localStorage key: follow the game onto whatever map you're actually on -
 * switch the Maps tab when a new raid starts, and when an in-raid screenshot
 * arrives, land on ITS map before the position marker ever renders (never
 * flash the marker on the map you happened to be viewing and then yank it
 * away once the switch catches up). Default OFF - no UI exposes this toggle
 * yet, so it must stay a no-op until one is wired up.
 */
export const COMPANION_MAP_FOLLOW_KEY = "tg.companion.mapfollow";
/**
 * localStorage key: the "Profile search (Win+Shift+S)" option - watch the
 * companion's clipboard change counter and, when a fresh snip appears, OCR it
 * and open that player's tarkov.dev stats page. Default OFF: while it is off
 * the companion is never asked to read the clipboard at all.
 */
export const COMPANION_KILLER_LOOKUP_KEY = "tg.companion.killerlookup";

export type CompanionQuestStatus = "started" | "finished" | "failed";
/**
 * `pvp_season`/`pve_season` are EFT 1.1.0.0's seasonal characters ("Session
 * mode: PvpSeason" in the logs). A seasonal character is a separate game
 * profile id with its own quest state; the mode token is what tells the site
 * to label it and track it apart from the main character.
 */
export type CompanionMode = "pvp" | "pve" | "pvp_season" | "pve_season";
export type CompanionFaction = "BEAR" | "USEC";

/**
 * Collapse whatever the companion reported into a known {@link CompanionMode},
 * or `null`. The payload crosses a version boundary in both directions: a
 * pre-2.1.8 companion passes the raw game token through untouched (observed as
 * `"pvpseason"`), and a future game build may invent new ones, so the mode is
 * validated here once instead of trusted at every use site. `null` (unknown)
 * makes the consumers stand down rather than mislabel or mis-sync.
 */
export function normalizeCompanionMode(raw: unknown): CompanionMode | null {
  if (typeof raw !== "string") return null;
  const low = raw.toLowerCase();
  if (low.includes("season")) return low.startsWith("pve") ? "pve_season" : "pvp_season";
  if (low === "pvp" || low === "regular") return "pvp";
  if (low.includes("pve")) return "pve";
  return null;
}

/** The base game mode a seasonal character plays under (pricing, profile mode). */
export function companionBaseMode(mode: CompanionMode): "pvp" | "pve" {
  return mode.startsWith("pve") ? "pve" : "pvp";
}

/** Whether this mode is one of EFT 1.1.0.0's seasonal-character modes. */
export function isSeasonalMode(mode: CompanionMode): boolean {
  return mode.endsWith("_season");
}

const COMPANION_MODE_LABEL: Record<CompanionMode, string> = {
  pvp: "PvP",
  pve: "PvE",
  pvp_season: "PvP Season",
  pve_season: "PvE Season",
};

/** Display label for a companion mode ("PvP", "PvP Season", ...). */
export function companionModeLabel(mode: CompanionMode): string {
  return COMPANION_MODE_LABEL[mode];
}

/** Player position from an in-raid screenshot: game-world x/z and facing (deg), plus a capture timestamp. */
export interface CompanionPosition {
  x: number;
  z: number;
  yaw: number | null;
  at: number;
  /**
   * EFT's own internal id for the location the shot was taken on (e.g.
   * `"RezervBase"`), read from the raid's `Location:` log line. `null` when no
   * raid was seen before the screenshot.
   *
   * Screenshot filenames carry coordinates but not the map, so without this a
   * position is just a bare `x`/`z` that would land anywhere. See
   * `maps/lib/raid-location.ts`, which refuses to draw a position it can't
   * place on the map being viewed.
   */
  map: string | null;
}

export interface CompanionStatus {
  app: string;
  version: string;
  running: boolean;
  session: string | null;
  gameVersion: string | null;
  mode: CompanionMode | null;
  profileId: string | null;
  faction: CompanionFaction | null;
  questsAvailable: boolean;
  quests: Record<string, CompanionQuestStatus>;
  questCounts: { started: number; finished: number; failed: number };
  position: CompanionPosition | null;
  positionRevision: number;
  /**
   * EFT's own internal id for the map of the current/most recent raid (e.g.
   * `"RezervBase"`), or `null` before any raid has been seen this session.
   * Present in the companion's `/status` payload since 2.1.7 ("raw superset"
   * capability) but not previously read anywhere on the site - `raid-location.ts`
   * only ever resolved a *position*'s map, never the raid's on its own.
   */
  raidLocation: string | null;
  /**
   * Whether the player is in an open raid right now, and whether they have
   * died in it (and are therefore spectating a teammate). Both added by
   * companion 2.5.0 alongside the `spectateGate` capability; optional here
   * because an older companion sends neither, and the validator deliberately
   * accepts those payloads rather than reporting the whole companion as down.
   */
  inRaid?: boolean;
  died?: boolean;
  /**
   * Feature flags the installed companion advertises (e.g. `"clipboardSnip"`).
   * Feature-detected against rather than comparing version numbers, so an
   * older companion degrades gracefully. Optional for the same reason as above.
   */
  capabilities?: string[];
  /**
   * Windows' global clipboard sequence number - bumped by the OS on every
   * clipboard change, carrying nothing of the content. Added by companion
   * 2.7.0 (`clipSeq` capability); the "Who killed me" watcher compares it
   * between polls to ask `/snip` only when a fresh snip actually exists.
   * Optional: older companions don't send it, and without it the watcher
   * simply never fires.
   */
  clipSeq?: number;
  revision: number;
  updatedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_QUEST_STATUSES: ReadonlySet<string> = new Set<CompanionQuestStatus>([
  "started",
  "finished",
  "failed",
]);
const VALID_FACTIONS: ReadonlySet<string> = new Set<CompanionFaction>(["BEAR", "USEC"]);

function isValidCompanionPosition(value: unknown): value is CompanionPosition {
  if (!isRecord(value)) return false;
  return (
    typeof value.x === "number" &&
    typeof value.z === "number" &&
    (value.yaw === null || typeof value.yaw === "number") &&
    typeof value.at === "number" &&
    (value.map === null || typeof value.map === "string")
  );
}

function isValidQuestsRecord(value: unknown): value is Record<string, CompanionQuestStatus> {
  return (
    isRecord(value) &&
    Object.values(value).every((status) => VALID_QUEST_STATUSES.has(status as string))
  );
}

/**
 * Guards the companion's `/status` response before any field beyond `app`
 * is trusted. Anything listening on `127.0.0.1:47800`-`47803` can answer
 * this request, normally the installed companion, but nothing stops another
 * local process from squatting the port and returning malformed data, which
 * would otherwise flow uncast into app state and, via
 * `useCompanionPosition`, into a live collaborative session's shared
 * presence for every other participant to render
 * (`session/liveblocks-config.tsx`).
 */
export function isValidCompanionStatus(value: unknown): value is CompanionStatus {
  if (!isRecord(value)) return false;
  if (typeof value.app !== "string" || typeof value.version !== "string") return false;
  if (typeof value.running !== "boolean" || typeof value.questsAvailable !== "boolean")
    return false;
  if (value.session !== null && typeof value.session !== "string") return false;
  if (value.gameVersion !== null && typeof value.gameVersion !== "string") return false;
  if (value.profileId !== null && typeof value.profileId !== "string") return false;
  // `mode` is only shape-checked, never value-checked: the wire spelling
  // varies by companion version (a pre-2.1.8 one passes the game's raw
  // "PvpSeason" through) and new game modes appear with patches. An
  // enumerated allowlist here rejected the ENTIRE seasonal payload - the
  // panel read "Not running" the moment the seasonal character was active.
  // `normalizeCompanionMode` (applied in fetchCompanionStatus) owns turning
  // the raw token into the known union, mapping anything unknown to null.
  if (value.mode !== null && typeof value.mode !== "string") return false;
  if (value.faction !== null && !VALID_FACTIONS.has(value.faction as string)) return false;
  if (!isValidQuestsRecord(value.quests)) return false;
  if (!isRecord(value.questCounts)) return false;
  if (
    typeof value.questCounts.started !== "number" ||
    typeof value.questCounts.finished !== "number" ||
    typeof value.questCounts.failed !== "number"
  ) {
    return false;
  }
  if (value.position !== null && !isValidCompanionPosition(value.position)) return false;
  // Treat `undefined` the same as `null`: an older companion this field
  // predates simply won't include the key at all, and that must never sink
  // the WHOLE payload (the exact class of bug `mode`'s check hit above).
  if (
    value.raidLocation !== undefined &&
    value.raidLocation !== null &&
    typeof value.raidLocation !== "string"
  ) {
    return false;
  }
  // Same undefined-tolerance as `raidLocation`: absent on older companions.
  if (value.clipSeq !== undefined && typeof value.clipSeq !== "number") return false;
  return (
    typeof value.positionRevision === "number" &&
    typeof value.revision === "number" &&
    typeof value.updatedAt === "number"
  );
}
