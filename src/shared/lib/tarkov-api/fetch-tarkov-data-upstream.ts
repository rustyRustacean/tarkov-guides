import { TARKOV_API_ENDPOINT, TARKOV_GQL_QUERY } from "./constants";

import type { RawTarkovApiResponseData, TarkovApiEnvelope } from "./types";

/**
 * POSTs the ported tarkov.dev query and returns its `data` section. Error
 * contract, ported from `refreshData.js`'s `refreshGameData` minus its
 * DOM/toast side effects:
 * - Non-2xx HTTP response → throws (legacy didn't check this explicitly;
 *   this is a strict superset of legacy's own eventual failure, since
 *   `.json()` on an HTML error page would otherwise throw an opaque
 *   JSON-parse error instead of a clear one).
 * - GraphQL `errors` present alongside `data` → dev-only `console.warn`,
 *   continue with the partial data. tarkov.dev has documented partial
 *   translation outages that return structurally-valid-but-empty sections
 *   alongside an `errors` array - one bad section shouldn't kill the whole
 *   refresh.
 * - `data` entirely missing → throws.
 *
 * The "both tasks and items ended up empty → throw, keep cached data"
 * safety net is NOT here - it needs the merged-with-previous result, not
 * just this raw fetch. See `use-tarkov-game-data.ts`.
 *
 * **Server-only** (2026-07-16 caching audit): called
 * exclusively by `src/app/api/tarkov-data/route.ts` now, never directly from
 * client code - that route's own `export const revalidate` is what caches
 * its response so every visitor shares it, instead of each browser hitting
 * tarkov.dev independently. This function deliberately does NOT set
 * `next: { revalidate }` on its own `fetch` call: confirmed via a real
 * production build that the full combined response (~7-10MB, dominated by
 * the `items` catalog) exceeds Next's fetch-level Data Cache's 2MB-per-entry
 * limit ("Failed to set Next.js data cache ... items over 2MB can not be
 * cached"), so that option would silently do nothing here - the route's own
 * segment-level caching is what actually works, confirmed by rebuilding
 * without this option and finding the cached `.next/server/app/api/
 * tarkov-data.body` artifact still generates identically.
 *
 * Named distinctly from `fetchTarkovGameData` (`fetch-tarkov-data.ts`, the
 * client's own entry point, which calls this route rather than tarkov.dev
 * directly) specifically so the two are never confused at a glance, and so
 * every existing test mocking the client-facing `fetchTarkovGameData` name
 * keeps working unmodified - only this file's name/export changed when the
 * proxy route was introduced, not the widely-mocked client-facing one.
 *
 * @param signal - Forwarded from React Query's `QueryFunctionContext` for automatic in-flight-request cancellation on unmount/refetch.
 */
export async function fetchTarkovDataUpstream(
  signal?: AbortSignal,
): Promise<RawTarkovApiResponseData> {
  const response = await fetch(TARKOV_API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: TARKOV_GQL_QUERY }),
    // exactOptionalPropertyTypes-safe: an omitted `signal` key, not an
    // explicit `signal: undefined`, matches RequestInit's own optionality.
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`tarkov.dev API responded with HTTP ${String(response.status)}`);
  }

  const envelope = (await response.json()) as TarkovApiEnvelope;

  if (envelope.errors && envelope.errors.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      "[tarkov-api] partial GraphQL errors, continuing with available data:",
      envelope.errors,
    );
  }

  if (!envelope.data) {
    throw new Error(envelope.errors?.[0]?.message ?? "tarkov.dev API returned no data");
  }

  return envelope.data;
}
