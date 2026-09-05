import type { RawTarkovApiResponseData } from "./types";

/** Same-origin path to the tarkov.dev proxy Route Handler (`src/app/api/tarkov-data/route.ts`). */
export const TARKOV_DATA_PROXY_PATH = "/api/tarkov-data";

/**
 * The client's sole entry point into tarkov.dev game data fetches the
 * already-unwrapped `RawTarkovApiResponseData` from this app's own
 * proxy rather than tarkov.dev directly. One upstream call per
 * revalidation window (12 hours).
 *
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
