/**
 * The MasterTarkov Companion is a small local program the user installs once.
 * It reads the Escape from Tarkov log files and exposes the active profile,
 * game mode, and quest state on a localhost port that this site polls. The
 * companion never touches the game process, memory, or files - it only reads
 * logs EFT already wrote to disk.
 */

export const COMPANION_PORT = 47800;
/**
 * Ports to look on, in order. The companion prefers the first but steps to the
 * next when an unrelated program already holds it - without probing the same
 * short list here, that machine would show "Not running" forever with the
 * companion working perfectly one port over.
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
 * never distinguish them - but a direct navigation isn't cross-origin, so the
 * companion can answer and name the address it refused.
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
 * This replaced a single self-installing .exe. That executable worked, but it
 * was unsigned with no reputation, so every new user hit a SmartScreen block -
 * and on one machine Defender quarantined it minutes after install, scoring the
 * self-copy plus autostart plus listening socket as a persistence pattern.
 * There is no free fix for that; the signing certificate is the fix.
 *
 * Text sidesteps the whole problem. Nothing is compiled, so there is nothing
 * to be suspicious of and nothing to sign - and the user can read every line
 * before running it, which a 7MB binary can never offer. Windows PowerShell is
 * already on the machine, so there is still nothing to download but this.
 */
export const COMPANION_DOWNLOAD_URL = "/companion/MasterTarkovCompanion.zip";
/**
 * The companion script, served as `text/plain` so it opens in the tab.
 *
 * A route rather than the `public/` file directly: static hosting serves a
 * `.ps1` as `application/octet-stream`, which downloads it instead of showing
 * it - the opposite of the point. The route reads the same file the zip is
 * built from, so there is no second copy to drift.
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
 * Gates the auto-launch protocol hand-off. Firing `masttarkov://` on a machine
 * that has no handler registered is not the silent no-op it was assumed to be -
 * Chromium shows an OS-level "Get an app to open this link" dialog, so every
 * visitor who never installed the companion got a Microsoft Store popup on page
 * load. Only machines that have had a working companion at least once may fire
 * it.
 */
export const COMPANION_EVER_CONNECTED_KEY = "tg.companion.everconnected";

export type CompanionQuestStatus = "started" | "finished" | "failed";
export type CompanionMode = "pvp" | "pve";
export type CompanionFaction = "BEAR" | "USEC";

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
   * position is just a bare `x`/`z` that would land anywhere - see
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
  revision: number;
  updatedAt: number;
}
