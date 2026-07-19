/** Metadata for one selectable theme, used to render the theme picker. */
export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  /** 4-color preview swatch, in [background, surface, accent, secondary-accent] order. */
  swatch: readonly [string, string, string, string];
}

/**
 * The 4 currently selectable themes: `inventory` (default, revised
 * 2026-07-16 - grey slots/grid-background game-UI theme, ported from
 * TarkovTrackerWB-main), `modern` (the former default - a fixed-dark
 * faithful port of `old/tarkov-tips`'s signature navy-blue gradient look),
 * `midnight` (clean, auto-follows system light/dark), and `terminal`
 * (phosphor CRT). Order here is the order rendered in the picker.
 *
 * `warm-gold` and `briefing` are disabled per user request (2026-07-18) -
 * commented out below rather than deleted, along with their CSS token
 * blocks in `globals.css`, so they can be restored later without
 * re-deriving the palettes. `isThemeId`/`THEME_IDS` no longer accept
 * either id, so a browser with one of them still in `localStorage` from
 * before this change falls back to `DEFAULT_THEME_ID` instead of applying.
 */
export const THEMES: readonly ThemeMeta[] = [
  {
    id: "inventory",
    name: "Inventory Grid",
    description: "Default - grey slots, grid background, game-UI feel",
    swatch: ["#1a1a1c", "#2c2c30", "#d4a548", "#5586c4"],
  },
  {
    id: "modern",
    name: "Modern",
    description: "Navy-blue gradient, green accent",
    swatch: ["#0f172a", "#172554", "#4ade80", "#059669"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Clean, auto light/dark",
    swatch: ["#ffffff", "#e4e4e7", "#18181b", "#2563eb"],
  },
  /* Disabled 2026-07-18 - see theme-config.ts doc comment above.
  {
    id: "warm-gold",
    name: "Warm Gold",
    description: "Gold + teal on warm charcoal",
    swatch: ["#0e0d0a", "#1d1c16", "#d4a548", "#4fb3a4"],
  },
  */
  {
    id: "terminal",
    name: "Tactical Terminal",
    description: "Phosphor green CRT, monospace, scan lines",
    swatch: ["#050805", "#0f1810", "#4af04a", "#f0c040"],
  },
  /* Disabled 2026-07-18 - see theme-config.ts doc comment above.
  {
    id: "briefing",
    name: "Mission Briefing",
    description: "Light parchment, typewriter, red stamps",
    swatch: ["#e8e2c8", "#d0c7a2", "#b3231f", "#4a5028"],
  },
  */
] as const;

export type ThemeId =
  | "modern"
  | "midnight"
  // | "warm-gold" - disabled 2026-07-18, see theme-config.ts doc comment above
  | "terminal"
  | "inventory";
// | "briefing" - disabled 2026-07-18, see theme-config.ts doc comment above

export const THEME_IDS: readonly ThemeId[] = [
  "inventory",
  "modern",
  "midnight",
  // "warm-gold", - disabled 2026-07-18, see theme-config.ts doc comment above
  "terminal",
  // "briefing", - disabled 2026-07-18, see theme-config.ts doc comment above
] as const;

export const DEFAULT_THEME_ID: ThemeId = "inventory";

/** localStorage key the active theme is persisted under. */
export const THEME_STORAGE_KEY = "tarkovguides.theme.v1";

/** Type guard narrowing an arbitrary string (e.g. from localStorage) to a valid {@link ThemeId}. */
export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value != null && (THEME_IDS as readonly string[]).includes(value);
}
