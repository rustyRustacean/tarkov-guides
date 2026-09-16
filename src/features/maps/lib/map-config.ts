import { assetPath } from "@/shared/lib/asset-cdn";

import { svgAssetPath, webpAssetPath } from "./map-assets";

import type { MapGeometryConfig, VariantCalibration } from "./leaflet-crs";

/**
 * One selectable rendering of a map: either the true "Satellite View" view
 * (a live tarkov.dev tile pyramid when {@link MapConfig.tileUrl} exists, or
 * a local SVG overlay otherwise) or a static overview/2D/3D image overlay.
 * Every non-tile variant needs a real local `imageUrl`; see
 * `public/maps/SOURCES.md` for where each bundled file came from.
 */
export interface MapVariant {
  id: string;
  label: string;
  /** Local `public/` URL (e.g. `/maps/svg/Reserve.svg`); unused when this is the `interactive` variant of a map that has a live `tileUrl`. For a user-uploaded variant (`custom: true`) this is a base64 data URL instead, resolved from IndexedDB; see `hooks/use-map-variants.ts`. */
  imageUrl: string;
  /** Marks the variant meant to render Leaflet-enhanced (tiles when available, otherwise this variant's own `imageUrl`). At most one per map. */
  interactive?: boolean;
  /** True for a variant merged in from the user's own uploads (`lib/map-variants.ts`'s `getMergedVariants`); never set on the static config table above. Lets UI (e.g. `MapVariantSwitcher`'s delete affordance) distinguish deletable custom variants from the built-in ones. */
  custom?: boolean;
  /** Per-variant affine placing game `(x,z)` on THIS image (game -> image fractional). Present only on manually-calibrated static 2D/3D variants whose framing differs from the map's shared geometry; absent variants use the map's `MAP_CONFIGS` geometry directly. */
  calibration?: VariantCalibration;
}

/**
 * Whether map markers (task pins/links/names and the live player position)
 * are placed accurately on a variant, and so should be shown.
 *
 * Accurate variants are the ones that project through the map's shared
 * geometry (the interactive "Satellite View" tiles and the "Overview" SVG
 * share the same frame) plus any static variant carrying a verified
 * per-variant `calibration` (only Reserve's 2D so far). Every other static
 * 2D/3D image is framed differently and would misplace markers until it's
 * calibrated, so markers stay hidden there.
 *
 * TEMPORARY gate (per the user, while 2D/3D calibration is in progress):
 * remove this once every 2D/3D variant is calibrated so markers show
 * everywhere again. The marker code itself is unchanged, only its display
 * is gated.
 */
export function variantHasAccurateMarkers(variant: MapVariant): boolean {
  return (
    variant.interactive === true || variant.id === "overview" || variant.calibration !== undefined
  );
}

/**
 * The variant to switch to when a live player position must actually be
 * SEEN: the map's default (`2d` first, see `defaultVariantId`) when that
 * already shows markers, otherwise the first variant that does - which in
 * practice is usually `interactive` (the live Satellite View tiles), since
 * `2d`/`3d` images are rarely calibrated. Returns null only for a map where
 * no variant can show markers, in which case there is nothing sensible to
 * switch to.
 *
 * This exists because `variantHasAccurateMarkers` hides the marker silently:
 * a sticky "2D" selection on Customs suppressed every marker for weeks with
 * no hint. Anything that reacts to a live position (auto-follow, the
 * hidden-position notice) resolves its target through here.
 */
export function markerVariantId(variants: readonly MapVariant[]): string | null {
  const preferred = variants.find((variant) => variant.id === defaultVariantId(variants));
  if (preferred && variantHasAccurateMarkers(preferred)) return preferred.id;
  return variants.find((variant) => variantHasAccurateMarkers(variant))?.id ?? null;
}

/**
 * One map's full configuration: variant list (display) merged with
 * geometry (alignment), ported from two separate, confusingly-named legacy
 * files (`old/TarkovTrackerWB-main/src/lib/mapsConfig.js`'s `MAP_VARIANTS`
 * and `src/lib/taskMarkers.js`'s `MAP_LEAFLET_CONFIG`; the latter lives in
 * a file named for task markers despite being the map geometry table).
 * Merged into one typed source here so variant metadata and alignment data
 * for the same map never drift apart in two separate places.
 */
export interface MapConfig extends MapGeometryConfig {
  name: string;
  variants: readonly MapVariant[];
  /** A live tarkov.dev tile pyramid URL template (`{z}/{x}/{y}.png`); when present, the `interactive` variant renders via `TileLayer`, not `ImageOverlay`. */
  tileUrl?: string;
  minNativeZoom?: number;
  maxNativeZoom?: number;
  minZoom: number;
  maxZoom: number;
}

/**
 * All 13 maps' configuration, ported verbatim from `MAP_VARIANTS`
 * (`mapsConfig.js`) + `MAP_LEAFLET_CONFIG` (`taskMarkers.js`): transform/
 * rotation/bounds/tile-zoom values are copied exactly, not re-derived.
 * Custom user-uploaded map variants are NOT part of this static table;
 * they're merged in at the store/selector level (see `store.ts`), since
 * they're per-installation, not build-time data.
 */
export const MAP_CONFIGS: Readonly<Record<string, MapConfig>> = {
  reserve: {
    name: "Reserve",
    transform: [0.395, 122.0, 0.395, 137.65],
    coordinateRotation: 180,
    bounds: [
      [289, -293],
      [-303, 244],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/reserve/main/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("Reserve.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Reserve.svg") },
      {
        id: "2d",
        label: "2D",
        imageUrl: webpAssetPath("reserve-2d.webp"),
        calibration: {
          a: -0.001053,
          b: 0.000281,
          c: 0.367809,
          d: 0.000481,
          e: 0.001777,
          f: 0.513364,
        },
      },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("reserve-3d.webp") },
      { id: "3d-tun", label: "Tunnels", imageUrl: webpAssetPath("reserve-3d-tunnels.webp") },
    ],
  },
  customs: {
    name: "Customs",
    transform: [0.239, 168.65, 0.239, 136.35],
    coordinateRotation: 180,
    bounds: [
      [698, -307],
      [-372, 237],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/customs_0.16/main/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("Customs.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Customs.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("customs-2d.webp") },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("customs-3d.webp") },
      { id: "3d-dorms", label: "Dorms", imageUrl: webpAssetPath("customs-3d-dorms.webp") },
    ],
  },
  woods: {
    name: "Woods",
    transform: [0.1855, 112.95, 0.1855, 167.85],
    coordinateRotation: 180,
    bounds: [
      [646, -914],
      [-761, 442],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/woods/main_0.16/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("Woods.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Woods.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("woods-2d.webp") },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("woods-3d.webp") },
    ],
  },
  "streets-of-tarkov": {
    name: "Streets of Tarkov",
    transform: [0.38, 0, 0.38, 0],
    coordinateRotation: 180,
    bounds: [
      [323, -295],
      [-280, 532],
    ],
    // No live tile pyramid for this map, so no Satellite View variant; the
    // Overview SVG overlay is the base view.
    minZoom: 0,
    maxZoom: 7,
    variants: [
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("StreetsOfTarkov.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("streets-2d.webp") },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("streets-3d.webp") },
      { id: "3d-caches", label: "3D caches", imageUrl: webpAssetPath("streets-3d-caches.webp") },
      { id: "3d-lexos", label: "Lexos", imageUrl: webpAssetPath("streets-3d-lexos.webp") },
    ],
  },
  shoreline: {
    name: "Shoreline",
    transform: [0.16, 83.2, 0.16, 111.1],
    coordinateRotation: 180,
    bounds: [
      [504, -415],
      [-1056, 618],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/shoreline/main_summer/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("Shoreline.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Shoreline.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("shoreline-2d.webp") },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("shoreline-3d.webp") },
      { id: "3d-resort", label: "Resort", imageUrl: webpAssetPath("shoreline-3d-resort.webp") },
    ],
  },
  // Labyrinth: underground area reached via Shoreline, its own map tab.
  // tarkov.dev publishes a satellite tile pyramid (tiles-only, no SVG);
  // the interactive variant uses that, and overview/2D fall back to the
  // one local raster overhead. Key is "the-labyrinth", the real
  // `normalizedName` (unlike the tile CDN's own path, which independently
  // uses bare "labyrinth", a different namespace, correctly left alone
  // below).
  "the-labyrinth": {
    name: "Labyrinth",
    transform: [2.115, 85.5, 2.115, 128.0],
    coordinateRotation: 270,
    bounds: [
      [-52, -37],
      [53, 76],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/labyrinth/main/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: webpAssetPath("labyrinth-2d.webp"),
        interactive: true,
      },
      // No separate "2D" tab: the only local raster that exists for Labyrinth
      // IS this overview, so a 2D entry would be the same picture under a
      // second name. Satellite View above is genuinely different (tiles).
      { id: "overview", label: "Overview", imageUrl: webpAssetPath("labyrinth-2d.webp") },
    ],
  },
  interchange: {
    name: "Interchange",
    transform: [0.265, 150.6, 0.265, 134.6],
    coordinateRotation: 180,
    bounds: [
      [598, -442],
      [-433, 426],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/interchange/main/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("Interchange.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Interchange.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("interchange-2d.webp") },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("interchange-3d.webp") },
    ],
  },
  lighthouse: {
    name: "Lighthouse",
    transform: [0.2, 0, 0.2, 0],
    coordinateRotation: 180,
    bounds: [
      [515, -998],
      [-545, 725],
    ],
    // No photo tile pyramid published for this map, so no Satellite View
    // variant; tarkov.dev's labelled SVG is the Overview base view.
    minZoom: 0,
    maxZoom: 7,
    variants: [
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Lighthouse.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("lighthouse-2d.webp") },
      {
        id: "2d-land",
        label: "2D landscape",
        imageUrl: webpAssetPath("lighthouse-2d-landscape.webp"),
      },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("lighthouse-3d.webp") },
    ],
  },
  "the-lab": {
    name: "The Lab",
    transform: [0.575, 281.2, 0.575, 193.7],
    coordinateRotation: 270,
    bounds: [
      [-80, -477],
      [-287, -193],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/labs_v4/1st/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("Labs.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Labs.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("labs-2d.webp") },
    ],
  },
  factory: {
    name: "Factory",
    transform: [1.629, 119.9, 1.629, 139.3],
    coordinateRotation: 90,
    bounds: [
      [77, -64.5],
      [-65.5, 67.4],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/factory/main/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("Factory.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Factory.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("factory-2d.webp") },
    ],
  },
  "ground-zero": {
    name: "Ground Zero",
    transform: [0.524, 167.3, 0.524, 65.1],
    coordinateRotation: 180,
    bounds: [
      [249, -124],
      [-99, 364],
    ],
    tileUrl: "https://assets.tarkov.dev/maps/groundzero/main_summer/{z}/{x}/{y}.png",
    minNativeZoom: 2,
    maxNativeZoom: 6,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Satellite View",
        imageUrl: svgAssetPath("GroundZero.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("GroundZero.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("ground-zero-2d.webp") },
      { id: "3d", label: "3D", imageUrl: webpAssetPath("ground-zero-3d.webp") },
    ],
  },
  terminal: {
    name: "Terminal",
    transform: [0.2, 0, 0.2, 0],
    coordinateRotation: 180,
    bounds: [
      [463, -580],
      [-433, 475],
    ],
    // No live tile pyramid for this map, so no Satellite View variant; the
    // Overview SVG overlay is the base view.
    minZoom: 0,
    maxZoom: 7,
    variants: [
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Terminal.svg") },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("terminal-2d.webp") },
      {
        id: "black-division",
        label: "Black Division",
        imageUrl: webpAssetPath("terminal-black-division.webp"),
      },
    ],
  },
  // Ice Breaker: newest EFT map, and the last one to get real imagery. The
  // placeholder SVG both variants used to share is gone, replaced by
  // tarkov.dev's live tile pyramid (Satellite View) and re3mr's 2D deck
  // plan. No SVG overhead exists for it (the SVG-maps repo still has none),
  // so unlike the other tile-backed maps its tiles are the Overview itself
  // rather than a separate "Satellite View" alongside one.
  //
  // The ship is drawn deck-by-deck: every tile pyramid under `maps/icebreaker/`
  // is one deck of the same hull, so `tileUrl` picks the deck the map opens
  // on (Infirmary, deck 1, tarkov.dev's own default) rather than a single
  // whole-map overhead like every other map here. Tiles exist at native
  // z0-z5 (no z6, unlike the rest).
  //
  // Key is "icebreaker" (no hyphen): tarkov.dev's real `normalizedName` for
  // this map has no hyphen, unlike every other multi-word map here (e.g.
  // "ground-zero"). "ice-breaker" (the asset filename's PascalCase inspired
  // an incorrect guess) never matched any real zone/task data for this map.
  icebreaker: {
    name: "Ice Breaker",
    transform: [2.0, 125.0, 3.5, 91.0],
    coordinateRotation: 180,
    // The one map whose bounds are NOT copied from tarkov.dev: their
    // `maps.json` still lists Factory's bounds verbatim for Ice Breaker
    // ([[77,-64.5],[-65.5,67.4]]), which frames a box ~2x the ship in
    // every direction, opening the map zoomed fully out with the hull a
    // fraction of the viewport. These are measured off the tile pyramid
    // itself instead: the non-transparent footprint of the assembled z2
    // tiles (x 102.25-153.5, y 14-255.5 of 256) run back through
    // `transform` (`lng = (125 - x) / 2`, `lat = (y - 91) / 3.5`), so the
    // ship fills the frame like every other map does. `transform` itself
    // is tarkov.dev's, unchanged; marker placement is unaffected by
    // bounds either way.
    bounds: [
      [11.4, -22],
      [-14.3, 47],
    ],
    // The one LOCAL tile pyramid: unlike the other tile-backed maps, whose
    // tiles are an optional Satellite View on top of a local SVG Overview,
    // these tiles ARE Ice Breaker's default Overview, so leaving them on the
    // CDN would have made this the only map whose default view needed the
    // internet. The full z0-z5 pyramid (1365 tiles, ~5.5MB, from the same
    // assets.tarkov.dev path; see public/maps/SOURCES.md) is bundled under
    // public/ instead, so all 13 maps' default views ship with the site.
    tileUrl: assetPath("/maps/tiles/icebreaker/06_infirmary/{z}/{x}/{y}.png"),
    minNativeZoom: 2,
    maxNativeZoom: 5,
    minZoom: 0,
    maxZoom: 7,
    variants: [
      // Tile-backed, but labelled "Overview" rather than "Satellite View":
      // on every other map those are two different pictures (live photo
      // tiles vs. the labelled SVG), while Ice Breaker has no SVG at all.
      // These tiles ARE its overview, and it's the view the map should open
      // on (`defaultVariantId` prefers `overview`).
      {
        id: "overview",
        label: "Overview",
        imageUrl: webpAssetPath("icebreaker-2d.webp"),
        interactive: true,
      },
      { id: "2d", label: "2D", imageUrl: webpAssetPath("icebreaker-2d.webp") },
    ],
  },
};

/** Looks up one map's config by its `normalizedName` (e.g. `"ground-zero"`). */
export function getMapConfig(normalizedName: string): MapConfig | undefined {
  return MAP_CONFIGS[normalizedName];
}

/**
 * First-visit / fallback variant for a map: `2d`, then `overview`, then
 * whatever's listed first. `2d` first per user direction (a calmer static
 * image is the preferred landing view); `overview` remains the fallback for
 * the handful of maps with no `2d` entry (`the-labyrinth`) and for markers,
 * which `variantHasAccurateMarkers` still treats as accurate on `overview`
 * regardless of which variant actually opens first.
 */
export function defaultVariantId(variants: readonly MapVariant[]): string {
  return (
    variants.find((variant) => variant.id === "2d")?.id ??
    variants.find((variant) => variant.id === "overview")?.id ??
    variants[0]?.id ??
    "2d"
  );
}

/**
 * The variant id to actually display for a map: the map's stored session
 * selection (see `store.ts`'s per-map `mapVariants`) when that map still has a
 * variant by that id, otherwise the map's default. Falling back keeps a stored
 * id that a map doesn't offer (e.g. a `2d`-only map, or a deleted custom
 * variant) from rendering nothing.
 */
export function resolveVariantId(
  variants: readonly MapVariant[],
  storedVariantId: string | null,
): string {
  if (storedVariantId !== null && variants.some((variant) => variant.id === storedVariantId)) {
    return storedVariantId;
  }
  return defaultVariantId(variants);
}

/** Every map's `normalizedName`, in the canonical display order used throughout this feature. */
export const MAP_NORMALIZED_NAMES: readonly string[] = [
  "reserve",
  "customs",
  "woods",
  "streets-of-tarkov",
  "shoreline",
  "the-labyrinth",
  "interchange",
  "lighthouse",
  "the-lab",
  "factory",
  "ground-zero",
  "terminal",
  "icebreaker",
];
