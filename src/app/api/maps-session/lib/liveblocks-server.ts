import "server-only";

import { Liveblocks } from "@liveblocks/node";

let cachedClient: Liveblocks | null = null;

/**
 * Lazily-constructed singleton `@liveblocks/node` client, gated on
 * `LIVEBLOCKS_SECRET_KEY`. Lazy (not constructed at module scope) so this
 * module can be imported without throwing in any environment that hasn't set
 * the env var yet (e.g. a fresh checkout before the key is configured), and
 * so route tests can mock this one function instead of the whole
 * `@liveblocks/node` package surface.
 */
export function getLiveblocksServerClient(): Liveblocks {
  if (cachedClient) return cachedClient;
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "LIVEBLOCKS_SECRET_KEY is not set - collaborative map sessions need a Liveblocks secret key (see .env.example).",
    );
  }
  cachedClient = new Liveblocks({ secret });
  return cachedClient;
}
