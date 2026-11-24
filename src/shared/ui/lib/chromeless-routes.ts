/**
 * Routes rendered with no site chrome (header, status banners, footer):
 * pages meant to be embedded elsewhere, like an event's stream overlay,
 * which OBS loads as a browser source on top of the stream.
 */
const CHROMELESS_PATTERNS: readonly RegExp[] = [/^\/resources\/events\/[^/]+\/overlay\/?$/];

/** True when `pathname` should render without the site header, banners and footer. */
export function isChromelessPath(pathname: string): boolean {
  return CHROMELESS_PATTERNS.some((pattern) => pattern.test(pathname));
}
