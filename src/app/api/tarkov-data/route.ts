import { NextResponse } from "next/server";

import { fetchTarkovDataUpstream } from "@/shared/lib/tarkov-api/fetch-tarkov-data-upstream";

/**
 * Route Segment Config: makes Next.js treat this route's own OUTPUT as a
 * cacheable, revalidate-after-1-hour artifact - this is what actually
 * caches the response, confirmed via a real production build (see the `GET`
 * doc comment below for why the more obvious-looking approach, annotating
 * the outbound `fetch` itself, does NOT work for this route). **Must be a
 * literal, not an imported constant** - confirmed via a real build failure
 * ("Invalid segment configuration export detected") that Next's route
 * segment config exports are statically analyzed at build time, not
 * evaluated as normal module code.
 */
export const revalidate = 3600;

/**
 * Server-side shared cache in front of tarkov.dev's upstream data API
 * (2026-07-16 caching audit; upstream itself moved from GraphQL to a
 * per-resource JSON API on 2026-07-29, see `fetch-tarkov-data-upstream.ts` -
 * this route's own caching mechanism, described below, is unaffected by
 * that change). Before this route existed, every visitor's browser called
 * tarkov.dev directly - React Query's `staleTime` only bounds how often a
 * SINGLE browser refetches, not how many browsers exist, so total upstream
 * load scaled with visitor count rather than staying a fixed constant.
 *
 * **What actually caches this route, confirmed empirically, not assumed
 * from docs:** the obvious-looking approach - annotating an outbound
 * `fetch` to tarkov.dev with `next: { revalidate }` - does NOT work here. A
 * real production build logged `Failed to set Next.js data cache for
 * https://api.tarkov.dev/graphql, items over 2MB can not be cached` (from
 * the original single-request GraphQL era; the finding itself still holds
 * for the new JSON API's `items` fetch, the one resource still large enough
 * to hit this limit) - the combined response (~7-10MB, dominated by the
 * `items` catalog) exceeds Next's fetch-level Data Cache's 2MB-per-entry
 * limit, so that annotation would silently do nothing. What actually works
 * is this file's own `export const revalidate` above (Route Segment
 * Config), which caches the ROUTE'S OWN RESPONSE as a static/ISR artifact -
 * a different Next.js mechanism than the per-fetch Data Cache, with no
 * matching size limit observed. Verified directly: rebuilt with and without
 * the (non-functional) `next.revalidate` fetch annotation and confirmed
 * `.next/server/app/api/tarkov-data.body` - the cached artifact backing this
 * route - generates identically either way; two consecutive requests
 * against a real `next start` production server returned byte-identical
 * payloads near-instantly (not two independent ~7MB live fetches, which
 * would almost certainly differ slightly given tarkov.dev's constantly-
 * fluctuating price fields).
 *
 * This is now the ONLY place in the app that talks to tarkov.dev directly -
 * the client fetches from here instead (`fetchTarkovGameData`,
 * `fetch-tarkov-data.ts` - kept at that well-known name/module path so the
 * ~26 existing tests mocking it didn't all need touching; only the
 * server-only upstream fetcher got a new name, `fetchTarkovDataUpstream`).
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
