# Maps

Unified interactive map viewer, faithfully porting TarkovTrackerWB-main's Leaflet-based interactive maps (quest markers, annotations, boss spawns, live clock, custom overlays), restyled with this project's design system. See migration plan Phase 5. **`old/tarkov-tips` contributes nothing to this phase** - a scope decision made with the user up front: its room-clearing rotation guides are explicitly excluded, not merged in as the original top-level migration plan framed it.

**Ported from (reference, do not lift-and-shift - rewritten clean, using `react-leaflet` rather than re-wrapping vanilla Leaflet):**

- `old/TarkovTrackerWB-main/src/components/maps/leaflet.js` - interactive map engine (largest single port target in the whole migration)
- `old/TarkovTrackerWB-main/src/lib/mapsConfig.js` - 13-map configuration (static vs. interactive variants), also owns custom-map IndexedDB storage
- `old/TarkovTrackerWB-main/src/lib/taskMarkers.js` - quest-marker overlay
- `old/TarkovTrackerWB-main/src/components/maps/annotations.js` - freehand annotation/drawing tool
- `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js` - boss spawn-chance strip + live in-game clock
- `old/TarkovTrackerWB-main/src/components/maps/fullscreen.js`, `mapZoom.js`, `mapSidebar.js`, `sidebarFocus.js` - fullscreen/zoom/sidebar-focus behavior
- `old/TarkovTrackerWB-main/src/components/maps/valuables.js` - high-value loot overlay

**Status:** implemented and live at `/maps`, linked from the site header's nav and the homepage's feature grid. Map imagery (38 files - 11 SVG + 27 WebP covering all 13 maps) is bundled under `public/maps/{svg,webp}/` - see `public/maps/SOURCES.md` for exact sourcing and licensing (the SVGs are CC BY-NC-SA 4.0, noncommercial use only). Ice Breaker is the one map with no SVG overhead published anywhere: its Overview renders from a per-deck tile pyramid instead, bundled locally under `public/maps/tiles/` (~5.5MB) so its default view ships with the site like every other map's, plus `icebreaker-2d.webp` as the 2D variant.

## Collaborative sessions (`session/`)

A host can start a shared session (via the "Collaborate" button, top-right of the map viewport) and share a join code, custom word, or invite link (`?session=CODE`) with others. While a session is active, the host's map/variant/pan/zoom drives everyone's view (a guest can request control, which the host grants/denies), and the drawing/annotation layer is shared and color-coded by author - reintroducing the multi-contributor drawing mode referenced in `lib/annotations.ts`'s `undoStroke` doc comment as having been dropped from this port.

Built on [Liveblocks](https://liveblocks.io) - the only real-time transport in this otherwise fully client-only app. **Requires a `LIVEBLOCKS_SECRET_KEY` env var** (a free Liveblocks account's secret API key, starts with `sk_`) for the two server routes under `src/app/api/maps-session/` that mint room tokens and end sessions - without it, hosting/joining a session will fail (the "Collaborate" button itself always renders; only the actual host/join network call needs the key). Set it in `.env.local` (gitignored, never commit a real key):

```
LIVEBLOCKS_SECRET_KEY=sk_...
```

No client-side Liveblocks key is needed - the client authenticates through this app's own `/api/maps-session/token` route (`session/liveblocks-config.ts`'s `authEndpoint`), not Liveblocks' public-key mode.
