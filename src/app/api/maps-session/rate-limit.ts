/**
 * A simple in-memory, fixed-window rate limiter for the maps-session API
 * routes. Deliberately not a durable/shared store (e.g. Redis): this app has
 * no such infra today, and a solo hobby project doesn't need one yet.
 * Trade-off accepted: on Vercel's serverless platform this map isn't shared
 * across concurrent instances/cold starts, so it under-limits slightly at
 * scale rather than over-blocking a single legitimate user. Good enough as
 * the load-bearing defense against code-guessing (see `token/route.ts`'s doc
 * comment); swap for a durable store later if abuse is ever observed.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Past this many tracked keys, expired windows are swept so a long-lived instance doesn't grow forever. */
const SWEEP_ABOVE = 10_000;

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Returns `true` if the call identified by `key` is allowed under a
 * `max`-per-`windowMs` fixed window, incrementing its count as a side effect;
 * `false` if the window's quota is already used up. `now` is an injectable
 * parameter (defaults to `Date.now()`) purely so tests can control time
 * without `vi.useFakeTimers()`'s global side effects.
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    if (!bucket && buckets.size >= SWEEP_ABOVE) sweepExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/**
 * The caller's IP from the standard reverse-proxy header (Vercel sets it
 * itself, overwriting anything the client sent), or `null` when there's no
 * usable value: no header, or an empty first entry.
 */
export function knownClientIp(request: Request): string | null {
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return first === "" ? null : first;
}

/** What {@link clientIpFrom} returns when the request carries no client IP. */
export const UNKNOWN_CLIENT_IP = "unknown";

/**
 * Best-effort caller IP for rate-limit keying. Falls back to a constant so
 * local dev (no proxy in front) still rate-limits per-process rather than
 * throwing. Anything that must tell callers apart (counting distinct
 * reporters) uses {@link knownClientIp} instead, since every request without
 * an IP shares this one value.
 */
export function clientIpFrom(request: Request): string {
  return knownClientIp(request) ?? UNKNOWN_CLIENT_IP;
}
