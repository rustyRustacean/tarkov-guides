/**
 * A simple in-memory, fixed-window rate limiter for the maps-session API
 * routes. Deliberately not a durable/shared store (e.g. Redis) - this app has
 * no such infra today, and a solo hobby project doesn't need one yet. The
 * accepted trade-off: on Vercel's serverless platform this map isn't shared
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
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/**
 * Best-effort caller IP for rate-limit keying, read from the standard
 * reverse-proxy header (Vercel and most CDNs set this). Falls back to a
 * constant so local dev (no proxy in front) still rate-limits per-process
 * rather than throwing.
 */
export function clientIpFrom(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}
