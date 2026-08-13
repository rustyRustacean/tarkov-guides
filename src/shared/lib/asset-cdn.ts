/**
 * Prefixes a local `public/` path with the static-asset CDN origin, read
 * from `NEXT_PUBLIC_ASSET_CDN_URL`. Unset today, so this is a no-op and
 * every caller resolves to the same local `/maps`/`/videos`/... URL as
 * before. The bundled map images (`public/maps/`) and PvP guide video
 * clips/stills (`public/videos/pvp-guide/`) are already mirrored to a
 * Cloudflare R2 bucket (see `public/maps/SOURCES.md`), so moving them live
 * later is one env var, not a code change: set
 * `NEXT_PUBLIC_ASSET_CDN_URL=https://<bucket-custom-domain>` in Vercel and
 * redeploy.
 */
export function assetPath(localPath: string): string {
  const base = process.env.NEXT_PUBLIC_ASSET_CDN_URL;
  return base ? `${base}${localPath}` : localPath;
}
