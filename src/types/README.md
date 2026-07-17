# Types

Shared TypeScript types used across multiple features (e.g. quest, item, map, tutorial, rotation shapes). Feature-local types stay colocated inside that feature's own folder instead of here.

**Colocation rule, concrete example (Phase 3):** types produced by a specific `shared/lib`/`shared/data` module stay colocated there even though many future features will consume them - e.g. `TarkovGameData`/`NormalizedItem`/`NormalizedTask` live in `src/shared/lib/tarkov-api/types.ts`, not here, because that module is their one clear owner. This matches the precedent set in Phase 2, where `ThemeId`/`ThemeMeta` stayed in `src/shared/ui/theme/theme-config.ts` despite being used site-wide. Reach for this folder only when a type has no single natural owning module (e.g. a shape two independent features both need but neither produces).

**Status:** still empty after Phase 3 - every type introduced there had exactly one owning module. Types get added here as a future feature phase introduces a shape with no single natural owner.
