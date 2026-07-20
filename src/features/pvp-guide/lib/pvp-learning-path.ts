import { getAllPvpTutorials } from "./tutorial-content";

import type { PvpTier, PvpTutorial } from "../types";

export interface LearningPathItem {
  tutorialSlug: string;
  order: number;
  tier: PvpTier;
  estimatedTime: number;
  /** Short summary of what this tutorial covers - shown on the Full Guide tab's tutorial-link cards. */
  description: string;
  prerequisites?: readonly string[];
}

/**
 * The ordered PvP tutorial path - ported from
 * `old/tarkov-tips/src/data/pvp-learning-path.ts`'s `pvpLearningPath`.
 * `isEssential`/`isIntermediate` boolean pair replaced with one `PvpTier`
 * union (the source's `false`+`false` = "advanced" convention was implicit
 * and easy to get wrong - a real tier value says so directly).
 */
export const PVP_LEARNING_PATH: {
  id: string;
  title: string;
  description: string;
  totalTime: number;
  items: readonly LearningPathItem[];
} = {
  id: "pvp-movement-mastery",
  title: "PvP Movement Mastery",
  description:
    "Master player combat through structured progression from movement basics to advanced PvP techniques.",
  totalTime: 190,
  // The Full Guide's path is now the same 7 chapters as the Quick Start tab,
  // in the same order - `advanced-peeking-techniques`/`movement-integration`/
  // `equipment-optimization` (the old pvp4/pvp8/pvp9) were superseded by the
  // peeking-essentials/gathering-intel/wiggle/jump-shots split and dropped
  // from the maintained path; their `.mdx` files and routes still exist,
  // just orphaned from this list.
  items: [
    {
      tutorialSlug: "circle-strafing",
      order: 1,
      tier: "essential",
      estimatedTime: 30,
      description:
        "Master the fundamental movement mechanics that form the foundation of all PvP encounters.",
    },
    {
      tutorialSlug: "peeking-essentials",
      order: 2,
      tier: "intermediate",
      estimatedTime: 45,
      description:
        "Learn to peek with minimal exposure, stay unpredictable, and know when to swing instead of sit.",
      prerequisites: ["circle-strafing"],
    },
    {
      tutorialSlug: "crosshair-placement",
      order: 3,
      tier: "essential",
      estimatedTime: 15,
      description:
        "Master crosshair placement and pre-aiming to turn reactions into tiny corrections instead of full ones.",
      prerequisites: ["peeking-essentials"],
    },
    {
      tutorialSlug: "gathering-intel",
      order: 4,
      tier: "intermediate",
      estimatedTime: 20,
      description:
        "Read footsteps, pivots, and other audio cues to know where the enemy is before you ever peek.",
      prerequisites: ["crosshair-placement"],
    },
    {
      tutorialSlug: "baiting",
      order: 5,
      tier: "intermediate",
      estimatedTime: 35,
      description: "Learn baiting techniques and audio manipulation to outsmart opponents.",
      prerequisites: ["gathering-intel"],
    },
    {
      tutorialSlug: "wiggle",
      order: 6,
      tier: "advanced",
      estimatedTime: 20,
      description:
        "Refine lean peeking into the wiggle - rapid side-to-side leans that break enemy pre-aim.",
      prerequisites: ["baiting"],
    },
    {
      tutorialSlug: "jump-shots",
      order: 7,
      tier: "advanced",
      estimatedTime: 25,
      description: "Chain a sprint-jump into a jump shot to cross openings with your weapon ready.",
      prerequisites: ["wiggle"],
    },
  ],
};

export interface LearningPathItemWithTutorial extends LearningPathItem {
  tutorial: PvpTutorial | undefined;
}

/** Joins {@link PVP_LEARNING_PATH}'s ordering/tier metadata with the real compiled tutorial content - ported from `old/tarkov-tips/src/lib/pvp-learning-path.ts`'s `getPVPLearningPathWithTutorials`. */
export function getPvpLearningPathWithTutorials(): readonly LearningPathItemWithTutorial[] {
  const tutorialsBySlug = new Map(getAllPvpTutorials().map((t) => [t.slug, t]));
  return PVP_LEARNING_PATH.items.map((item) => ({
    ...item,
    tutorial: tutorialsBySlug.get(item.tutorialSlug),
  }));
}

/**
 * The tutorial immediately after `currentSlug` in the path, or `null` at the
 * end (or for an unknown slug). Ported from the source's
 * `getNextTutorialInPath` - unlike the source, this is actually called (by
 * `PvpTutorialPage`'s prev/next nav), not dead code.
 */
export function getNextTutorialInPath(currentSlug: string): LearningPathItemWithTutorial | null {
  const path = getPvpLearningPathWithTutorials();
  const index = path.findIndex((item) => item.tutorialSlug === currentSlug);
  if (index === -1 || index === path.length - 1) return null;
  return path[index + 1] ?? null;
}

/** The tutorial immediately before `currentSlug` in the path, or `null` at the start (or for an unknown slug). */
export function getPreviousTutorialInPath(
  currentSlug: string,
): LearningPathItemWithTutorial | null {
  const path = getPvpLearningPathWithTutorials();
  const index = path.findIndex((item) => item.tutorialSlug === currentSlug);
  if (index <= 0) return null;
  return path[index - 1] ?? null;
}

/**
 * `currentSlug`'s 1-based position in the path (`current`/`total`, matching
 * `getNextTutorialInPath`'s use of `notFound()`-safe fallbacks: an unknown
 * slug reports `0 of N`), plus a `percentage` that's deliberately *not*
 * `current / total` - chapters vary wildly in length (Peeking Essentials is
 * ~2000 words, Wiggle is a two-sentence stub), so a flat per-chapter
 * increment would jump the same amount for either one. Instead it's the
 * share of the whole path's word count that comes strictly *before* this
 * chapter (via each tutorial's real `wordCount`), so the bar reflects how
 * much of the guide you'd have actually read by the time you reach it - a
 * fixed value per chapter, not a live reading-scroll tracker.
 */
export function getTutorialProgressInPath(currentSlug: string): {
  current: number;
  total: number;
  percentage: number;
} {
  const path = getPvpLearningPathWithTutorials();
  const index = path.findIndex((item) => item.tutorialSlug === currentSlug);
  const total = path.length;
  if (index === -1) return { current: 0, total, percentage: 0 };

  const wordCounts = path.map((item) => item.tutorial?.wordCount ?? 0);
  const totalWords = wordCounts.reduce((sum, words) => sum + words, 0);
  const priorWords = wordCounts.slice(0, index).reduce((sum, words) => sum + words, 0);

  return {
    current: index + 1,
    total,
    percentage: totalWords === 0 ? 0 : Math.round((priorWords / totalWords) * 100),
  };
}
