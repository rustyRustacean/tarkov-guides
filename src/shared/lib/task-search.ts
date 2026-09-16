import type { NormalizedTask } from "./tarkov-api/types";

/**
 * Splits a free-text search box's value into lowercased, trimmed,
 * comma-separated OR terms (e.g. `"prapor, kappa"` -> `["prapor", "kappa"]`).
 * Ported from `old/TarkovTrackerWB-main/src/components/maps/mapSidebar.js`'s
 * search-mode query parsing.
 */
export function parseSearchTerms(query: string): readonly string[] {
  return query
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
}

/**
 * Loose match against name/trader/map (normalizedName or its
 * space-separated form)/item name/the literal word "kappa". `term` must
 * already be lowercased (see {@link parseSearchTerms}).
 */
export function taskMatchesTerm(task: NormalizedTask, term: string): boolean {
  if (task.name.toLowerCase().includes(term)) return true;
  if (task.trader.name.toLowerCase().includes(term)) return true;
  if (
    task.maps.some(
      (map) => map.toLowerCase().includes(term) || map.replace(/-/g, " ").includes(term),
    )
  ) {
    return true;
  }
  if (task.itemRequirements.some((item) => item.name.toLowerCase().includes(term))) return true;
  if (term === "kappa" && task.kappaRequired) return true;
  return false;
}

/**
 * Whether `task` matches a raw (not yet comma-split) search-box query: the
 * single-task filter predicate shared by `QuestBoard`'s toolbar search box
 * (used directly by `QuestSwimlaneMatrix`/`CommandDeckBoard`; Tree never
 * hides nodes, see its own doc comment). The tracker's views used to each
 * hand-roll their own, weaker, name-only
 * substring check while Maps' own `taskMatchesTerm` (above) already matched
 * name, trader, map, item, and "kappa"; promoted here so every search box
 * agrees on what "matches" means. An empty/blank query matches every task (this
 * function is meant to sit inside a `.filter()` alongside other filters,
 * not gate a dedicated search-results view the way `searchTasks`
 * (`features/maps/lib/map-sidebar-tasks.ts`) does, since that one
 * deliberately returns nothing for a blank query to flip the Maps sidebar
 * into a distinct "search mode").
 */
export function taskMatchesQuery(task: NormalizedTask, query: string): boolean {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return true;
  return terms.some((term) => taskMatchesTerm(task, term));
}
