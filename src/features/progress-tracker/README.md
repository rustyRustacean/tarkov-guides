# Progress Tracker

Unified quest/task, stash, hideout, and kappa-collector tracking - merges TarkovTrackerWB-main's stash/hideout/kappa/profile mechanics with tarkov-tips's richer quest-tree visualization and analytics. See migration plan Phase 4.

**Ported from (reference, do not lift-and-shift - rewrite clean):**

- `old/tarkov-tips/src/components/kappa/QuestTracker.tsx`, `QuestCard.tsx`, `quests/*`, `analytics/*` - quest-tree visualization, filters, search, tooltips, analytics/charts/recommendations (visual backbone)
- `old/TarkovTrackerWB-main/src/components/traders/traders.js`, `src/components/tasks/taskActions.js` - trader-grouped task list logic reference
- `old/TarkovTrackerWB-main/src/components/items/customItems.js`, `itemAdjust.js`, `itemRows.js`, `pins.js` - item/stash have-vs-pending tracking, DIED/EXTRACTED raid-commit workflow
- `old/tarkov-tips/src/components/kappa/ItemsTracker.tsx` (hideout + quest-items tabs only - NOT manual-tracker/OCR), `ItemCard.tsx`, `ItemTable.tsx`
- `old/TarkovTrackerWB-main/src/components/kappa/kappa.js` - kappa/collector undo-stack tracker
- `old/TarkovTrackerWB-main/src/components/hideout/hideoutGoal.js` - hideout tracker + goal-path planner
- `old/TarkovTrackerWB-main/src/components/profile/profile.js`, `src/lib/tarkovData.js` - multi-profile support (faction, PvP/PvE mode, avatar)
- `old/TarkovTrackerWB-main/src/lib/persistence.js` - backup/restore (localStorage baseline → File System Access API → JSON export/import)

Flea calculator, item location hints, and beginner-items data are shared data-layer concerns - see `src/shared/lib` and `src/shared/data`, not this folder. `ItemRow`/`ItemTrackerBoard` consume them directly; `BeginnerItemsGuide` (the Guide tab) consumes `src/shared/data/beginner-items.ts` + `src/shared/lib/item-resolution`.

**Status:** COMPLETE - implemented and live at `/progress-tracker` (linked from the site header). Quests (list/tree/trader/recommendations/analytics), Items (stash tracking, flea tax/net readout, location hints, raid-commit), a beginner-items Guide, Kappa, Hideout, multi-profile, and Backup/Restore (localStorage + manual JSON export/import + optional FSA folder sync) are all built, tested (484 tests: 476 unit/component + 8 e2e - golden path, DIED/EXTRACTED+undo, profile isolation), and verified against the real live tarkov.dev API and across all 6 themes.
