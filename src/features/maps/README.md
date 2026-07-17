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

**Status:** implemented and live at `/maps`, linked from the site header's nav and the homepage's feature grid. Map imagery (38 files, ~63MB - 12 SVG + 26 JPG covering all 13 maps) is bundled under `public/maps/{svg,jpg}/` - see `public/maps/SOURCES.md` for exact sourcing and licensing (the SVGs are CC BY-NC-SA 4.0, noncommercial use only). `IceBreaker.svg` remains a placeholder, not a real overhead map - no public source exists for it yet.
