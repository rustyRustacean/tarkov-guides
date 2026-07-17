import {
  Anton,
  Bebas_Neue,
  Cormorant_Garamond,
  Crimson_Pro,
  Inter,
  JetBrains_Mono,
  Lora,
  Rajdhani,
  Special_Elite,
  Stardos_Stencil,
} from "next/font/google";
import localFont from "next/font/local";

/**
 * Every font instance the site uses across its 6 themes, centralized in one
 * module (next/font's static-analysis requirement - calls scattered across
 * files aren't supported). All fonts load unconditionally and their
 * `.variable` classes are applied to `<html>` in the root layout, since
 * every theme's font stack must be simultaneously available for instant
 * theme switching without a page reload.
 *
 * Font-to-theme mapping lives in `globals.css`'s `[data-theme="…"]` blocks,
 * not here - this module only defines the CSS variables; the theme blocks
 * decide which ones each theme's `--font`/`--display`/`--num` reference.
 */

/** Bender (SIL OFL) - Modern theme's display font, and the theme-independent Header wordmark font. */
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
 * Wotfard - Modern theme's body font. Only a regular (400) weight file is
 * shipped; other weights are browser-synthesized via `font-synthesis:
 * weight` (declared in `globals.css`, not here - that's a stylistic choice
 * ported deliberately from the legacy site, not a `next/font` option).
 */
export const wotfard = localFont({
  src: "./fonts/wotfard/wotfard-regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-wotfard",
});

/** Warm Gold theme body font; Inventory theme body font. */
export const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/** Warm Gold theme body-font fallback; Warm Gold `--num` fallback. */
export const rajdhani = Rajdhani({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rajdhani",
});

/** Warm Gold theme display font (paired with Cormorant Garamond). */
export const lora = Lora({
  weight: ["400", "500"],
  style: "italic",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lora",
});

/** Warm Gold theme primary display font. */
export const cormorantGaramond = Cormorant_Garamond({
  weight: ["500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant-garamond",
});

/** Terminal theme's sole font (body/display/num); shared `--num` monospace across all themes. */
export const jetBrainsMono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

/** Briefing theme display-font fallback. */
export const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bebas-neue",
});

/** Briefing theme display-font fallback. */
export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-anton",
});

/** Briefing theme body/num font. */
export const specialElite = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-special-elite",
});

/** Briefing theme primary display font. */
export const stardosStencil = Stardos_Stencil({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-stardos-stencil",
});

/** Briefing theme body-font fallback. */
export const crimsonPro = Crimson_Pro({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-crimson-pro",
});

/** Every font's CSS variable class, applied together to `<html>` in the root layout. */
export const fontVariables = [
  bender.variable,
  wotfard.variable,
  inter.variable,
  rajdhani.variable,
  lora.variable,
  cormorantGaramond.variable,
  jetBrainsMono.variable,
  bebasNeue.variable,
  anton.variable,
  specialElite.variable,
  stardosStencil.variable,
  crimsonPro.variable,
].join(" ");
