import { MAX_REQUESTS_PER_MINUTE } from "../lib/route-limits";

const WINDOW_MS = 60_000;
/** Most clients tracked at once; the oldest is dropped past this. */
const MAX_TRACKED = 5000;

const HITS = new Map<string, number[]>();

/**
 * Counts one request from `client` and says how many seconds it must wait, or
 * 0 when it may go ahead. Per server instance only: a best-effort guard
 * against a loop hammering the endpoint, not an exact quota.
 */
export function retryAfterSeconds(client: string, now = Date.now()): number {
  const recent = (HITS.get(client) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
    HITS.set(client, recent);
    const oldest = recent[0] ?? now;
    return Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
  }
  recent.push(now);
  // Re-insert so the map stays ordered by most recent activity.
  HITS.delete(client);
  HITS.set(client, recent);
  if (HITS.size > MAX_TRACKED) {
    const oldest = HITS.keys().next();
    if (!oldest.done) HITS.delete(oldest.value);
  }
  return 0;
}

/** For tests: forget every client. */
export function resetRateLimit(): void {
  HITS.clear();
}
