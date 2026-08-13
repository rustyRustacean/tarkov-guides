import { NextResponse } from "next/server";

import { fetchTarkovDataUpstream } from "@/shared/lib/tarkov-api/fetch-tarkov-data-upstream";

/**
 * Route Segment Config: makes Next.js treat this route's own output as a
 * cacheable, revalidate-after-1-hour artifact. This is what actually caches
 * the response (see the `GET` doc comment below for why annotating the
 * outbound `fetch` itself does not work here). Must be a literal, not an
 * imported constant: Next statically analyzes route segment config exports
 * at build time rather than evaluating them as normal module code.
 */
export const revalidate = 3600;

/**
 * Server-side shared cache in front of tarkov.dev's upstream data API (see
 * `fetch-tarkov-data-upstream.ts`). Before this route existed, every
 * visitor's browser called tarkov.dev directly; React Query's `staleTime`
 * only bounds how often a single browser refetches, not how many browsers
 * exist, so total upstream load scaled with visitor count.
 *
 * The obvious approach, annotating the outbound `fetch` to tarkov.dev with
 * `next: { revalidate }`, does not work here: the combined response
 * (~7-10MB, dominated by the `items` catalog) exceeds Next's fetch-level
 * Data Cache's 2MB-per-entry limit, so that annotation silently does
 * nothing. What actually caches this route is the `export const revalidate`
 * above (Route Segment Config), which caches the route's own response as a
 * static/ISR artifact, a different Next.js mechanism with no matching size
 * limit.
 *
 * This is now the only place in the app that talks to tarkov.dev directly;
 * the client fetches from here instead (`fetchTarkovGameData`,
 * `fetch-tarkov-data.ts`, kept at that name so existing tests mocking it
 * didn't need touching; only the server-only upstream fetcher got a new
 * name, `fetchTarkovDataUpstream`).
 */
export async function GET() {
  try {
    const data = await fetchTarkovDataUpstream();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error fetching tarkov.dev data";
    return NextResponse.json({ message }, { status: 502 });
  }
}
