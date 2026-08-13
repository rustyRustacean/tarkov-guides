import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";

/**
 * Every font instance the site's active themes use, centralized in one
 * module (next/font requires static analysis, so calls can't be scattered
 * across files). All fonts load unconditionally and their `.variable`
 * classes are applied to `<html>` in the root layout, since every active
 * theme's font stack must be simultaneously available for instant theme
 * switching without a page reload.
 *
 * Font-to-theme mapping lives in `globals.css`'s `[data-theme="…"]` blocks,
 * not here: this module only defines the CSS variables; the theme blocks
 * decide which ones each theme's `--font`/`--display`/`--num` reference.
 *
 * **Only the 4 families the 4 active themes reference are loaded.** Fonts
 * for disabled themes (`warm-gold`/`briefing`, whose `[data-theme]` blocks
 * in `globals.css` and entries in `shared/ui/theme/theme-config.ts` are
 * commented out) were removed too, since `next/font/google` preloads by
 * default and there's no reason to ship font weight for a palette no user
 * can select. **Reviving either theme means restoring its font instances
 * here alongside uncommenting its CSS block and its `theme-config.ts`
 * entry**: the commented CSS blocks still reference the removed `--font-*`
 * variables, so uncommenting alone would silently fall through to each
 * stack's generic fallback.
 */

/** Bender (SIL OFL): Modern/Inventory themes' display font, and the theme-independent Header wordmark font. */
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
 * Plus Jakarta Sans (Google Fonts, OFL): Modern and Midnight themes' body
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
