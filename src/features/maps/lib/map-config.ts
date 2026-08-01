import { jpgAssetPath, svgAssetPath } from "./map-assets";

import type { MapGeometryConfig, VariantCalibration } from "./leaflet-crs";

/**
 * One selectable rendering of a map - either the true "Interactable" view
 * (a live tarkov.dev tile pyramid when {@link MapConfig.tileUrl} exists, or
 * a local SVG overlay otherwise) or a static overview/2D/3D image overlay.
 * Every non-tile variant needs a real local `imageUrl` - see
 * `public/maps/SOURCES.md` for where each bundled file came from.
 */
export interface MapVariant {
  id: string;
  label: string;
  /** Local `public/` URL (e.g. `/maps/svg/Reserve.svg`) - unused when this is the `interactive` variant of a map that has a live `tileUrl`. For a user-uploaded variant (`custom: true`) this is a base64 data URL instead, resolved from IndexedDB - see `hooks/use-map-variants.ts`. */
  imageUrl: string;
  /** Marks the variant meant to render Leaflet-enhanced (tiles when available, otherwise this variant's own `imageUrl`). At most one per map. */
  interactive?: boolean;
  /** True for a variant merged in from the user's own uploads (`lib/map-variants.ts`'s `getMergedVariants`) - never set on the static config table above. Lets UI (e.g. `MapVariantSwitcher`'s delete affordance) distinguish deletable custom variants from the built-in ones. */
  custom?: boolean;
  /** Per-variant affine placing game `(x,z)` on THIS image (game -> image fractional). Present only on manually-calibrated static 2D/3D variants whose framing differs from the map's shared geometry; absent variants use the map's `MAP_CONFIGS` geometry directly. */
  calibration?: VariantCalibration;
}

/**
 * One map's full configuration - variant list (display) merged with
 * geometry (alignment), ported from two separate, confusingly-named legacy
 * files (`old/TarkovTrackerWB-main/src/lib/mapsConfig.js`'s `MAP_VARIANTS`
 * and `src/lib/taskMarkers.js`'s `MAP_LEAFLET_CONFIG` - the latter lives in
 * a file named for task markers despite being the map geometry table).
 * Merged into one typed source here so variant metadata and alignment data
 * for the same map never drift apart in two separate places.
 */
export interface MapConfig extends MapGeometryConfig {
  name: string;
  variants: readonly MapVariant[];
  /** A live tarkov.dev tile pyramid URL template (`{z}/{x}/{y}.png`) - when present, the `interactive` variant renders via `TileLayer`, not `ImageOverlay`. */
  tileUrl?: string;
  minNativeZoom?: number;
  maxNativeZoom?: number;
  minZoom: number;
  maxZoom: number;
}

/**
 * All 13 maps' configuration, ported verbatim from `MAP_VARIANTS`
 * (`mapsConfig.js`) + `MAP_LEAFLET_CONFIG` (`taskMarkers.js`) - transform/
 * rotation/bounds/tile-zoom values are copied exactly, not re-derived.
 * Custom user-uploaded map variants are NOT part of this static table -
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
        label: "Interactable",
        imageUrl: svgAssetPath("Reserve.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Reserve.svg") },
      {
        id: "2d",
        label: "2D",
        imageUrl: jpgAssetPath("reserve-2d.jpg"),
        calibration: {
          a: -0.001053,
          b: 0.000281,
          c: 0.367809,
          d: 0.000481,
          e: 0.001777,
          f: 0.513364,
        },
      },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("reserve-3d.jpg") },
      { id: "3d-tun", label: "3D tunnels", imageUrl: jpgAssetPath("reserve-3d-tunnels.jpg") },
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
        label: "Interactable",
        imageUrl: svgAssetPath("Customs.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Customs.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("customs-2d.jpg") },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("customs-3d.jpg") },
      { id: "3d-dorms", label: "3D dorms", imageUrl: jpgAssetPath("customs-3d-dorms.jpg") },
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
        label: "Interactable",
        imageUrl: svgAssetPath("Woods.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Woods.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("woods-2d.jpg") },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("woods-3d.jpg") },
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
    // No live tile pyramid for this map - the interactive variant is an SVG image overlay.
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Interactable",
        imageUrl: svgAssetPath("StreetsOfTarkov.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("StreetsOfTarkov.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("streets-2d.jpg") },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("streets-3d.jpg") },
      { id: "3d-caches", label: "3D caches", imageUrl: jpgAssetPath("streets-3d-caches.jpg") },
      { id: "3d-lexos", label: "3D Lexos", imageUrl: jpgAssetPath("streets-3d-lexos.jpg") },
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
        label: "Interactable",
        imageUrl: svgAssetPath("Shoreline.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Shoreline.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("shoreline-2d.jpg") },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("shoreline-3d.jpg") },
      { id: "3d-resort", label: "3D resort", imageUrl: jpgAssetPath("shoreline-3d-resort.jpg") },
    ],
  },
  // Labyrinth - underground area reached via Shoreline, its own map tab.
  // tarkov.dev publishes a satellite tile pyramid (tiles-only, no SVG) -
  // the interactive variant uses that; overview/2D fall back to the one
  // local raster overhead. Key is "the-labyrinth" - confirmed via a live
  // API query that this is the real `normalizedName` (unlike the tile
  // CDN's own path, which independently uses bare "labyrinth" - a
  // different namespace, correctly left alone below). A step-8 live
  // cross-check caught this as a real bug from step 3.
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
        label: "Interactable",
        imageUrl: jpgAssetPath("labyrinth-2d.jpg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: jpgAssetPath("labyrinth-2d.jpg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("labyrinth-2d.jpg") },
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
        label: "Interactable",
        imageUrl: svgAssetPath("Interchange.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Interchange.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("interchange-2d.jpg") },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("interchange-3d.jpg") },
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
    // No photo tile pyramid published for this map - the interactive
    // variant is tarkov.dev's own hosted labelled SVG.
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Interactable",
        imageUrl: svgAssetPath("Lighthouse.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Lighthouse.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("lighthouse-2d.jpg") },
      {
        id: "2d-land",
        label: "2D landscape",
        imageUrl: jpgAssetPath("lighthouse-2d-landscape.jpg"),
      },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("lighthouse-3d.jpg") },
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
        label: "Interactable",
        imageUrl: svgAssetPath("Labs.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Labs.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("labs-2d.jpg") },
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
        label: "Interactable",
        imageUrl: svgAssetPath("Factory.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Factory.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("factory-2d.jpg") },
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
        label: "Interactable",
        imageUrl: svgAssetPath("GroundZero.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("GroundZero.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("ground-zero-2d.jpg") },
      { id: "3d", label: "3D", imageUrl: jpgAssetPath("ground-zero-3d.jpg") },
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
    // No live tile pyramid for this map - the interactive variant is an SVG image overlay.
    minZoom: 0,
    maxZoom: 7,
    variants: [
      {
        id: "interactive",
        label: "Interactable",
        imageUrl: svgAssetPath("Terminal.svg"),
        interactive: true,
      },
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("Terminal.svg") },
      { id: "2d", label: "2D", imageUrl: jpgAssetPath("terminal-2d.jpg") },
    ],
  },
  // Ice Breaker - newest EFT map, no real overhead published anywhere yet
  // (confirmed: not even the SVG-maps source repo has one) - both variants
  // point at the same not-yet-sourced placeholder file so the map still
  // renders a coherent "not sourced yet" state rather than a broken image.
  // Key is "icebreaker" (no hyphen) - confirmed via a live API query that
  // tarkov.dev's real `normalizedName` for this map has no hyphen, unlike
  // every other multi-word map here (e.g. "ground-zero"); a step-8 live
  // cross-check caught this as a real bug from step 3 - "ice-breaker" (the
  // asset filename's PascalCase inspired an incorrect guess) never matched
  // any real zone/task data for this map.
  icebreaker: {
    name: "Ice Breaker",
    transform: [0.2, 0, 0.2, 0],
    bounds: [
      [400, -400],
      [-400, 400],
    ],
    minZoom: 0,
    maxZoom: 7,
    variants: [
      { id: "overview", label: "Overview", imageUrl: svgAssetPath("IceBreaker.svg") },
      { id: "2d", label: "2D", imageUrl: svgAssetPath("IceBreaker.svg") },
    ],
  },
};

/** Looks up one map's config by its `normalizedName` (e.g. `"ground-zero"`). */
export function getMapConfig(normalizedName: string): MapConfig | undefined {
  return MAP_CONFIGS[normalizedName];
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
