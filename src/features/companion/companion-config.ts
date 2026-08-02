/**
 * The MasterTarkov Companion is a small local program the user installs once.
 * It reads the Escape from Tarkov log files and exposes the active profile,
 * game mode, and quest state on a localhost port that this site polls. The
 * companion never touches the game process, memory, or files - it only reads
 * logs EFT already wrote to disk.
 */

export const COMPANION_PORT = 47800;
export const COMPANION_BASE_URL = `http://127.0.0.1:${String(COMPANION_PORT)}`;
export const COMPANION_STATUS_URL = `${COMPANION_BASE_URL}/status`;

/** Custom URL protocol registered by the companion's setup, used to start it on demand. */
export const COMPANION_PROTOCOL = "masttarkov";
export const COMPANION_LAUNCH_URL = `${COMPANION_PROTOCOL}://launch`;

/** One-file installer: download it, double-click, it does the rest (installs to %APPDATA%, never Downloads). Served from `public/`. */
export const COMPANION_DOWNLOAD_URL = "/companion/MasterTarkov-Companion-Setup.bat";

export const COMPANION_POLL_INTERVAL_MS = 5000;
/** A localhost request should answer near-instantly; give up quickly if it doesn't. */
export const COMPANION_REQUEST_TIMEOUT_MS = 1500;

/** localStorage key: whether to auto-start the companion when the site loads. */
export const COMPANION_AUTOLAUNCH_KEY = "tg.companion.autolaunch";
/** localStorage key: whether to auto-match/create the tracker profile from the game. */
export const COMPANION_PROFILE_SYNC_KEY = "tg.companion.profilesync";
/** localStorage key: JSON map of the game's profile id -> tracker profile id. */
export const COMPANION_PROFILE_MAP_KEY = "tg.companion.profilemap";

export type CompanionQuestStatus = "started" | "finished" | "failed";
export type CompanionMode = "pvp" | "pve";
export type CompanionFaction = "BEAR" | "USEC";

/** Player position from an in-raid screenshot: game-world x/z and facing (deg), plus a capture timestamp. */
export interface CompanionPosition {
  x: number;
  z: number;
  yaw: number | null;
  at: number;
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
