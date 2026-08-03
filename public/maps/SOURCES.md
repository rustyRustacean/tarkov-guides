# Map image sources & licensing

38 map images (12 SVG + 26 WebP) powering `src/features/maps`, copied from
`old/TarkovTrackerWB/map-assets/` (itself sourced from two upstream tarkov.dev repos).
`src/features/maps/lib/map-config.ts` references every file here by exact name via
`svgAssetPath`/`webpAssetPath` (`src/features/maps/lib/map-assets.ts`) - nothing is missing;
this is the complete set for all 13 maps.

## Upstream sources

- **SVGs** (`svg/`) → [the-hideout/tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps)
- **WebPs** (`webp/`) → [the-hideout/tarkov-dev](https://github.com/the-hideout/tarkov-dev/tree/main/public/maps),
  transcoded from the upstream JPGs (see below) - re-pull and re-transcode from there if a newer
  upstream JPG is published.

Every filename matches its upstream name save for the extension (SVGs are PascalCase, e.g.
`Reserve.svg`; WebPs are kebab-case, e.g. `reserve-2d.webp`, matching the upstream JPG's base name).

## JPG → WebP transcode

The raster variants originally shipped as the upstream JPGs verbatim (~63MB total). They're now
re-encoded as WebP (`sharp`, quality 82, effort 6, dimensions untouched) to cut bundle/R2 size
before upload - re-encoding a already-lossy JPEG at high WebP quality does not reliably shrink it
(WebP can lose to a heavily-compressed source JPEG above ~q88), so q82 was chosen as the point
that stayed comfortably smaller across both lightly- and heavily-compressed sources while staying
visually indistinguishable from the source JPG. If a file ever needs re-deriving losslessly,
pull the original JPG fresh from the upstream repo rather than re-encoding the local WebP (WebP →
WebP re-encoding compounds generation loss).

## Licensing - read before any commercial deployment

**The SVG maps (`svg/`) are CC BY-NC-SA 4.0 - noncommercial use only.** See
[LICENSE.md](https://github.com/the-hideout/tarkov-dev-svg-maps/blob/main/LICENSE.md) in the
upstream repo before redistributing or deploying this site commercially. The WebP maps (`webp/`)
are transcoded from the MIT-licensed `tarkov-dev` repo's JPGs.

## `IceBreaker.svg` is a placeholder, not a real map

Ice Breaker is new enough that no public overhead map exists yet - `IceBreaker.svg` is a
stand-in so the map renders a coherent state instead of a broken image, not a real overhead.
Both of `icebreaker`'s variants in `map-config.ts` point at this same file. Replace it if/when a
real one is published (tarkov.dev now has `icebreaker-2d.jpg` upstream, not yet pulled in here).

## Deliberately not included

Referenced by nothing in `map-config.ts`: `openworld-2d.jpg`, `transits-2d.jpg`. Not every map
needs a local file at all - `reserve`, `customs`, `woods`, `shoreline`, `interchange`, `the-lab`,
`factory`, `ground-zero`, and `the-labyrinth`'s "Interactable" variant render from tarkov.dev's
own live tile CDN (`assets.tarkov.dev`) instead of a local image.
