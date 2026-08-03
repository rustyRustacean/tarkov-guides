# Map image sources & licensing

38 map images (11 SVG + 27 JPG, ~65MB) powering `src/features/maps`, copied from
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

## Ice Breaker

No longer a placeholder: the stand-in `IceBreaker.svg` is gone, replaced by `icebreaker-2d.jpg`
(re3mr's deck-by-deck plan of the ship) plus tarkov.dev's live tile pyramid for the Satellite
View. There's still no SVG overhead for this map in the SVG-maps repo, so `icebreaker` is the
one map with no "Overview" variant - the 2D deck plan is its default view.

The ship is mapped one deck at a time, so `maps/icebreaker/` on the tile CDN holds 16 separate
pyramids (`00_control_room` ... `15_bridge_roof`) rather than a single overhead; `map-config.ts`
points the Satellite View at `06_infirmary`, the deck tarkov.dev itself opens on.

## Deliberately not included

Referenced by nothing in `map-config.ts`: `openworld-2d.jpg`, `transits-2d.jpg`. Not every map
needs a local file at all - `reserve`, `customs`, `woods`, `shoreline`, `interchange`, `the-lab`,
`factory`, `ground-zero`, and `the-labyrinth`'s "Interactable" variant render from tarkov.dev's
own live tile CDN (`assets.tarkov.dev`) instead of a local image.
