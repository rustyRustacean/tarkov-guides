import type { RawTarkovApiResponseData } from "./types";

/** Same-origin path to the tarkov.dev proxy Route Handler (`src/app/api/tarkov-data/route.ts`). */
export const TARKOV_DATA_PROXY_PATH = "/api/tarkov-data";

/**
 * The client's sole entry point into tarkov.dev game data: fetches the
 * already-unwrapped `RawTarkovApiResponseData` from this app's own
 * server-side proxy rather than tarkov.dev directly. Before this, every
 * visitor's browser called tarkov.dev independently (React Query's
 * `staleTime` only bounds how often a SINGLE browser refetches, not how
 * many browsers exist), so upstream load scaled with visitor count. The
 * proxy route's own cached response (shared across every request, not
 * per-browser; see that route's doc comment for exactly which Next.js
 * mechanism achieves this) now caps that at roughly one upstream call per
 * revalidation window (1 hour), total.
 *
 * Kept at this same name/module path deliberately (rather than renaming to
 * something like `fetchTarkovGameDataFromProxy`): every consumer of game
 * data, and every existing test mocking this exact function, already
 * targets `fetchTarkovGameData` from `fetch-tarkov-data.ts`. The function
 * that actually talks to tarkov.dev directly moved to a newly-and-
 * distinctly-named `fetchTarkovDataUpstream` (`fetch-tarkov-data-upstream.ts`,
 * called only by the proxy route) instead, so only ONE file's contract
 * changed rather than needing every one of the ~26 files that mock this
 * name to be touched.
 *
 * Mirrors `fetchTarkovDataUpstream`'s non-2xx-throws contract, but prefers
 * the proxy's own JSON error `message` when present (surfaces the real
 * upstream failure reason, e.g. "tarkov.dev API responded with HTTP 503",
 * rather than a generic "proxy responded with HTTP 502" that loses that
 * detail).
 *
 * @param signal - Forwarded from React Query's `QueryFunctionContext` for automatic in-flight-request cancellation on unmount/refetch.
 */
export async function fetchTarkovGameData(signal?: AbortSignal): Promise<RawTarkovApiResponseData> {
  const response = await fetch(TARKOV_DATA_PROXY_PATH, {
    // exactOptionalPropertyTypes-safe: an omitted `signal` key, not an
    // explicit `signal: undefined`, matches RequestInit's own optionality.
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body !== null &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `Tarkov data proxy responded with HTTP ${String(response.status)}`;
    throw new Error(message);
  }

  return (await response.json()) as RawTarkovApiResponseData;
}
