import type { NextConfig } from "next";

/**
 * Deliberately not `immutable`/a 1-year `max-age`: unlike `_next/static`'s
 * content-hashed build output, files under `public/` here keep their plain
 * filename across content changes (verified in practice - the pvp-guide
 * video assets have already been overwritten in place, same filename, more
 * than once) so a fully immutable cache would leave returning visitors
 * stuck with stale/wrong content for the whole cache lifetime with zero
 * revalidation. 1 day gives a real repeat-visit bandwidth win while
 * bounding worst-case staleness after an in-place swap to about a day;
 * `must-revalidate` stops a stale entry from being served indefinitely past
 * that. Swap to a cache-busting query string or rename the file for any
 * future change that needs to bypass this immediately.
 */
const STATIC_ASSET_CACHE_CONTROL = "public, max-age=86400, must-revalidate";

const nextConfig: NextConfig = {
  devIndicators: false,
  headers() {
    return [
      {
        source: "/videos/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
      },
      {
        source: "/maps/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE_CONTROL }],
      },
    ];
  },
};

export default nextConfig;
