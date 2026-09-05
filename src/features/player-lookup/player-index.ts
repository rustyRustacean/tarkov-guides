/**
 * Nickname -> tarkov.dev account id, resolved against tarkov.dev's published
 * player index.
 *
 * WHY THIS IS SERVER-SIDE ONLY: the index is a single ~67 MB JSON file
 * (2,963,313 entries for PvP, plus a separate 112,845-entry PvE one). Sending
 * that to a browser once, let alone per lookup, is out of the question, so the
 * download happens here and is cached in module scope.
 *
 * WHY IT'S SEARCHED AS BYTES, NOT PARSED: `JSON.parse` on 67 MB of
 * `{"15":"Buhaus",...}` builds a three-million-key object and costs hundreds
 * of megabytes of heap that never gets used again - this only ever needs one
 * lookup at a time. Holding the raw bytes and scanning them keeps the
 * footprint at the file's own size and the search at a few milliseconds.
 */

/** The two indexes tarkov.dev publishes - one per game mode. */
const INDEX_URLS = {
  pvp: "https://players.tarkov.dev/profile/index.json",
  pve: "https://players.tarkov.dev/pve/index.json",
} as const;

export type GameMode = keyof typeof INDEX_URLS;

/**
 * tarkov.dev sits behind Cloudflare, which answers a request carrying no
 * recognizable User-Agent with a 403 challenge page rather than the file
 * (confirmed: bare `curl` gets 403, the same request with a browser UA gets
 * 200). Every fetch here therefore identifies itself.
 */
const FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
} as const;

/** The index is rebuilt daily upstream, so a 12-hour cache is never far behind. */
const INDEX_TTL_MS = 12 * 60 * 60 * 1000;

interface CachedIndex {
  bytes: Buffer;
  fetchedAt: number;
}

const cache = new Map<GameMode, CachedIndex>();
// One in-flight download per mode: without this, several lookups arriving
// before the first finishes would each pull their own 67 MB copy.
const inFlight = new Map<GameMode, Promise<Buffer>>();

async function loadIndex(mode: GameMode, now: number): Promise<Buffer> {
  const cached = cache.get(mode);
  if (cached && now - cached.fetchedAt < INDEX_TTL_MS) return cached.bytes;

  const existing = inFlight.get(mode);
  if (existing) return existing;

  const request = (async () => {
    const response = await fetch(INDEX_URLS[mode], { headers: FETCH_HEADERS });
    if (!response.ok) throw new Error(`player index ${mode}: HTTP ${String(response.status)}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    cache.set(mode, { bytes, fetchedAt: now });
    return bytes;
  })().finally(() => {
    inFlight.delete(mode);
  });

  inFlight.set(mode, request);
  return request;
}

/**
 * Escape a nickname for use inside a regex. Nicknames are user-chosen and
 * reach this from OCR, so they can contain anything.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The account id whose nickname is exactly `nickname`, or null.
 *
 * Matching is case-insensitive because OCR has no reliable sense of case on
 * stylized text, and EFT nicknames are unique case-insensitively anyway.
 * The entry shape is `"<id>":"<nickname>"`, so the id is read back off the
 * match rather than the whole file being indexed.
 */
export async function findAccountId(
  nickname: string,
  mode: GameMode,
  now: number = Date.now(),
): Promise<string | null> {
  if (!nickname.trim()) return null;
  const bytes = await loadIndex(mode, now);
  // latin1 keeps one byte per character, so offsets stay honest and no 67 MB
  // UTF-16 copy is made; nicknames outside ASCII simply won't match, which is
  // the same outcome as not being in the index.
  const haystack = bytes.toString("latin1");
  const pattern = new RegExp(`"(\\d+)":"${escapeRegex(nickname)}"`, "i");
  return pattern.exec(haystack)?.[1] ?? null;
}

/** Test seam: drop cached indexes so a test can control what a fetch returns. */
export function resetPlayerIndexCache(): void {
  cache.clear();
  inFlight.clear();
}

/** Test seam: preload an index without hitting the network. */
export function primePlayerIndexCache(
  mode: GameMode,
  json: string,
  now: number = Date.now(),
): void {
  cache.set(mode, { bytes: Buffer.from(json, "latin1"), fetchedAt: now });
}
