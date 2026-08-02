const preloaded = new Set<string>();

/**
 * Warms the browser's image cache for a URL once, so a later `<img>` of the
 * same URL paints instantly. No-op on the server, for an empty URL, or a URL
 * already requested. Ported from `old/TarkovTrackerWB-main/src/lib/wiki.js`'s
 * `_preloadImgUrl`.
 */
export function preloadImage(url: string | null): void {
  if (!url || typeof Image === "undefined" || preloaded.has(url)) return;
  preloaded.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}
