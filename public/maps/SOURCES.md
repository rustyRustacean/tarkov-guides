# Map image sources & licensing

38 map images (12 SVG + 26 JPG, ~63MB) powering `src/features/maps`, copied from
`old/TarkovTrackerWB/map-assets/` (itself sourced from two upstream tarkov.dev repos).
`src/features/maps/lib/map-config.ts` references every file here by exact name via
`svgAssetPath`/`jpgAssetPath` (`src/features/maps/lib/map-assets.ts`) - nothing is missing;
this is the complete set for all 13 maps.

## Upstream sources

- **SVGs** (`svg/`) → [the-hideout/tarkov-dev-svg-maps](https://github.com/the-hideout/tarkov-dev-svg-maps)
- **JPGs** (`jpg/`) → [the-hideout/tarkov-dev](https://github.com/the-hideout/tarkov-dev/tree/main/public/maps)

Every filename matches its upstream name exactly (SVGs are PascalCase, e.g. `Reserve.svg`; JPGs
are kebab-case, e.g. `reserve-2d.jpg`).

## Licensing - read before any commercial deployment

**The SVG maps (`svg/`) are CC BY-NC-SA 4.0 - noncommercial use only.** See
[LICENSE.md](https://github.com/the-hideout/tarkov-dev-svg-maps/blob/main/LICENSE.md) in the
upstream repo before redistributing or deploying this site commercially. The JPG maps (`jpg/`)
are from the MIT-licensed `tarkov-dev` repo.

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
