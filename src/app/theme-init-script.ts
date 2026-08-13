import { DEFAULT_THEME_ID, THEME_IDS, THEME_STORAGE_KEY } from "@/shared/ui/theme/theme-config";

/**
 * Anti-FOUC blocking script, injected via `<Script strategy="beforeInteractive">`
 * in the root layout. Runs before React hydrates and before first paint,
 * picking which of the 6 `data-theme` values applies and setting it
 * synchronously so the correct theme's CSS is active from the first frame.
 * Midnight's own light/dark split needs no JS (pure
 * `@media (prefers-color-scheme: dark)` CSS); this script only resolves
 * which named theme is active, not light vs. dark within Midnight.
 *
 * Kept as a plain string (not inline JSX) so its logic is unit-testable
 * without a full browser; see `theme-init-script.test.ts`.
 */
export const themeInitScript = `(function () {
  try {
    var STORAGE_KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
    var VALID = ${JSON.stringify(THEME_IDS)};
    var stored = localStorage.getItem(STORAGE_KEY);
    var theme = stored && VALID.indexOf(stored) !== -1 ? stored : ${JSON.stringify(DEFAULT_THEME_ID)};
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();`;
