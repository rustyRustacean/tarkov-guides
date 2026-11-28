/** For responses no cache may keep: errors, and anything that depends on a key. */
export const NO_STORE: Readonly<Record<string, string>> = { "cache-control": "no-store" };

/**
 * Headers that let Vercel's CDN serve one copy of a response for `maxAgeS`
 * seconds, and a stale copy for `staleS` more while it refreshes, while
 * browsers revalidate on every request.
 *
 * The CDN's policy goes in `CDN-Cache-Control` (RFC 9213, honored by
 * Vercel), with the browser-facing `Cache-Control` saying "always
 * revalidate". Putting `stale-while-revalidate` in the plain
 * `Cache-Control` instead let browsers keep showing stale data for the whole
 * stale window after each poll (measured 2026-11-22 on the event snapshot:
 * about 14 s from a score change to a viewer seeing it, versus about 100 ms
 * for Liveblocks itself). Nothing can purge these copies, so anything hidden
 * or deleted can stay visible for up to `maxAgeS + staleS`.
 */
export function cdnCacheHeaders(maxAgeS: number, staleS: number): Record<string, string> {
  return {
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": `public, max-age=${String(maxAgeS)}, stale-while-revalidate=${String(staleS)}`,
  };
}
