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

const isDev = process.env.NODE_ENV === "development";

/**
 * Baseline CSP (pre-production security pass). `script-src`/`style-src`
 * need `'unsafe-inline'`: Next's App Router streams RSC hydration payloads
 * via per-request inline `<script>` tags it generates itself (not
 * attacker-controllable, but not something a static hash or header-based
 * CSP can allowlist either), and this site's own anti-FOUC theme-init
 * script (`src/app/theme-init-script.ts`, injected `beforeInteractive` in
 * `layout.tsx`) is likewise inline. Removing `'unsafe-inline'` requires
 * Next's nonce+proxy pattern (see `node_modules/next/dist/docs/01-app/
 * 02-guides/content-security-policy.md`), which forces every page into
 * dynamic rendering (no ISR/static generation) - a real regression against
 * this site's SSR/ISR architecture (`ARCHITECTURE.md`), so that's tracked
 * as a follow-up decision rather than silently adopted here. Every other
 * directive is scoped tight: no external script/object sources, and
 * `connect-src`/`img-src`/`frame-src` list only origins this app actually
 * talks to (tarkov.dev's asset CDN, the Fandom wiki API/CDN, Liveblocks'
 * realtime service, and the local companion app on loopback).
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://assets.tarkov.dev https://static.wikia.nocookie.net;
  font-src 'self';
  connect-src 'self' https://escapefromtarkov.fandom.com https://*.liveblocks.io wss://*.liveblocks.io http://127.0.0.1:*;
  frame-src 'self' masttarkov:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // No `includeSubDomains`: this app doesn't control every subdomain of its
  // parent domain (see HOSTING.md's odqum.com origin allowlist), and HSTS's
  // subdomain flag would force HTTPS on all of them for every visitor here.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
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
