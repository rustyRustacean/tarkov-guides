import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";

/**
 * Every font instance the site's active themes use, centralized in one
 * module (next/font's static-analysis requirement - calls scattered across
 * files aren't supported). All fonts load unconditionally and their
 * `.variable` classes are applied to `<html>` in the root layout, since
 * every active theme's font stack must be simultaneously available for
 * instant theme switching without a page reload.
 *
 * Font-to-theme mapping lives in `globals.css`'s `[data-theme="…"]` blocks,
 * not here - this module only defines the CSS variables; the theme blocks
 * decide which ones each theme's `--font`/`--display`/`--num` reference.
 *
 * **Only the 4 families the 4 ACTIVE themes actually reference are loaded.**
 * The 8 that existed solely for `warm-gold`/`briefing` (Anton, Bebas Neue,
 * Cormorant Garamond, Crimson Pro, Lora, Rajdhani, Special Elite, Stardos
 * Stencil) were removed 2026-08-02: those two themes were disabled
 * 2026-07-18 (their `[data-theme]` blocks in `globals.css` and their entries
 * in `shared/ui/theme/theme-config.ts` are commented out) but their fonts
 * kept loading - and preloading, since `next/font/google` defaults
 * `preload: true` when `subsets` is given - on every route, for palettes no
 * user could select. **Reviving either theme means restoring its font
 * instances here alongside uncommenting its CSS block and its
 * `theme-config.ts` entry** - the commented blocks still reference the
 * removed `--font-*` variables, so uncommenting alone would silently fall
 * through to each stack's generic fallback.
 */

/** Bender (SIL OFL) - Modern/Inventory themes' display font, and the theme-independent Header wordmark font. */
export const bender = localFont({
  src: [
    { path: "./fonts/bender/bender-light.otf", weight: "300", style: "normal" },
    { path: "./fonts/bender/bender-light-italic.otf", weight: "300", style: "italic" },
    { path: "./fonts/bender/bender-regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/bender/bender-regular-italic.otf", weight: "400", style: "italic" },
    { path: "./fonts/bender/bender-bold.otf", weight: "700", style: "normal" },
    { path: "./fonts/bender/bender-bold-italic.otf", weight: "700", style: "italic" },
    { path: "./fonts/bender/bender-black.otf", weight: "900", style: "normal" },
    { path: "./fonts/bender/bender-black-italic.otf", weight: "900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-bender",
});

/**
 * Plus Jakarta Sans (Google Fonts, OFL) - Modern and Midnight themes' body
 * font. Replaces Wotfard, which is free for personal use only and not
 * commercially licensed.
 */
export const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

/** Inventory theme's body font, and the pre-hydration `:root` default (which mirrors Inventory). */
export const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/** Terminal theme's sole font (body/display/num); shared `--num` monospace across all themes. */
export const jetBrainsMono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

/** Every font's CSS variable class, applied together to `<html>` in the root layout. */
export const fontVariables = [
  bender.variable,
  plusJakartaSans.variable,
  inter.variable,
  jetBrainsMono.variable,
].join(" ");
