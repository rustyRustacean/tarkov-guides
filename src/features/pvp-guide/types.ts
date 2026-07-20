/**
 * Frontmatter for one PvP tutorial's MDX file. A trimmed, properly-typed
 * version of `old/tarkov-tips/src/types/tutorial.ts`'s `TutorialFrontmatter`
 * - deliberately drops `category` (the source mislabels 4 of its 6 real
 * `.mdx` files with copy-paste-wrong values like `"weapons"`/`"economy"`;
 * that field only mattered for filtering across tarkov-tips's multi-topic
 * tutorial catalog, which this self-contained feature doesn't have - every
 * article here is definitionally PvP content, so the field has no purpose
 * to get right, only a bug to inherit) and `series` (same reasoning - it
 * only distinguished PvP tutorials from non-PvP ones within a shared
 * catalog). `order` is promoted from an informal, untyped MDX-frontmatter
 * extension (present in every source file but absent from the shared type)
 * to a real, typed field, since it's this feature's actual sort key.
 */
export interface PvpTutorialFrontmatter {
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  maps?: readonly string[];
  publishedAt: string;
  updatedAt: string;
  gameVersion: string;
  tags?: readonly string[];
  order: number;
}

/** One PvP tutorial's raw (uncompiled) content plus its parsed frontmatter - mirrors `old/tarkov-tips/src/types/tutorial.ts`'s `Tutorial` shape. */
export interface PvpTutorial {
  slug: string;
  frontmatter: PvpTutorialFrontmatter;
  /** Raw MDX body (frontmatter stripped) - compiled on demand via `lib/mdx.ts`'s `compilePvpTutorialMDX`, not eagerly, so listing pages that only need metadata never pay for a full MDX compile. */
  content: string;
  /** Whole minutes, from the `reading-time` package applied to `content`. */
  readingTimeMinutes: number;
  /** Exact word count from the same `reading-time` call - the weight `getTutorialProgressInPath` uses for its word-count-proportional progress bar, since chapters vary wildly in length (see `lib/pvp-learning-path.ts`). */
  wordCount: number;
}

/** Which learning-path tier a tutorial belongs to - derived from `LearningPathItem.isEssential`/`isIntermediate`, never stored directly (mirrors `TaskStatus`'s "never persist a derived value" convention elsewhere in this project). */
export type PvpTier = "essential" | "intermediate" | "advanced";
