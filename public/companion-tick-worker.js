/*
 * Metronome for the companion poll while the tab is hidden - which it ALWAYS
 * is when it matters, because the player is tabbed into the game.
 *
 * Chrome throttles main-thread timers in hidden tabs (down to ~once a minute
 * after five minutes), so TanStack Query's own refetchInterval crawled the
 * moment a raid started: teammates' markers moved once a minute at best.
 * Worker timers are exempt from tab-visibility throttling, so this posts a
 * tick at full cadence and the page refetches on each one (use-companion.ts,
 * acquireBackgroundTicker).
 *
 * A static file rather than an inline Blob worker on purpose: the CSP has no
 * worker-src, so workers fall back to script-src 'self' - a same-origin file
 * is allowed, a blob: URL is not.
 *
 * Protocol: the page posts the interval in ms once; each tick posts back 0.
 */
let timer = null;
onmessage = (event) => {
  clearInterval(timer);
  timer = setInterval(() => {
    postMessage(0);
  }, event.data);
};
