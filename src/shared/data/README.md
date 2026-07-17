# Shared Data

Static reference data + typed loaders for content genuinely NOT available from the live tarkov.dev GraphQL fetch (`src/shared/lib/tarkov-api`).

**What's here:**

- `beginner-items.ts` - hand-authored "what to hoard your first 2 weeks" guide content, ported from `old/TarkovTrackerWB-main/src/data/beginnerItems.js`. Entries reference items by a curated shorthand (`short`/`nameLike`), not a tarkov.dev id - resolve them against live item data via `resolveGameItem`/`resolveGameItems` (`src/shared/lib/item-resolution`).
- `item-locations.ts` - hand-authored per-item, per-map "where to find it" hints, ported from `old/TarkovTrackerWB-main/src/data/itemLocations.js`. Same custom-shorthand resolution story - use `findItemLocationEntry` (`src/shared/lib/item-resolution`).
- `ballistics/` - `ammo.json`/`armor.json`/`plates.json`/`rigs.json`, copied verbatim from `old/tarkov-tips/src/data/`, plus `ballistics-types.ts`/`ballistics.ts` typed wrappers. Curated ballistics content not selected by the live GraphQL query; needed by Phase 6's ballistics calculator. `plates.json`/`rigs.json` are confirmed (via a full field scan) to carry zero stat data today - they're allowlists of which items count as a plate/rig, not ballistics numbers.

**What's deliberately NOT here, and why:** the original Phase 3 plan called for porting ~17 JSON files from `old/tarkov-tips/src/data/` (`items.json`, `items-search.json`, `items-stats.json`, `item-categories.json`, `item-icons.json`, `tarkov-items.json`, `traders.json`, `hideout.json`, `itemsHideout.json`, `quests.json`, `questItems.json`, `itemsQuests.json`, `maps.json`) plus `public/data/barter-items.json`. A research pass before implementation found:

- `items.json` (~22.7MB) has **zero runtime consumers** in in-scope code - it's read only by build scripts (one of which doesn't even use the data it loads) or by OCR-excluded files already out of scope per the Phase 0 `MIGRATION-SKIP-OCR` annotations.
- `quests.json`, `hideout.json`, `traders.json`, `maps.json`, and the various items-derived files are stale point-in-time API dumps that duplicate exactly what the live GraphQL query in `shared/lib/tarkov-api` already fetches fresh.
- `old/tarkov-tips` has no GraphQL/fetch code of its own at all (confirmed via exhaustive grep) - `old/TarkovTrackerWB-main`'s query is the only one in either legacy repo, and it's the one that got ported.

**Decision (confirmed with the project owner):** the live GraphQL fetch (`useTarkovGameData()`) is the sole source of truth for items, tasks, hideout stations, traders, maps, barters, and crafts - none of the above JSON files are ported as static bundled data. If a later feature needs a fast local search index (e.g. item autocomplete), derive it from the already-fetched/cached `TarkovGameData.items` list at that time rather than shipping a second static copy now. `maps.json`'s extraction/geometry data is deferred to Phase 5 (Maps), when it's actually needed.

**Status:** implemented (Phase 3).
