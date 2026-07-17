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
  totalTime: 230,
  items: [
    {
      tutorialSlug: "pvp1",
      order: 1,
      tier: "essential",
      estimatedTime: 30,
      description:
        "Master the fundamental movement mechanics that form the foundation of all PvP encounters.",
    },
    {
      tutorialSlug: "pvp3",
      order: 2,
      tier: "essential",
      estimatedTime: 30,
      description: "Master crosshair placement and pre-aiming to win fights before they start.",
    },
    {
      tutorialSlug: "pvp4",
      order: 3,
      tier: "intermediate",
      estimatedTime: 45,
      description: "Master peeking mechanics from intelligence gathering to combat execution.",
      prerequisites: ["pvp1", "pvp3"],
    },
    {
      tutorialSlug: "pvp5",
      order: 4,
      tier: "intermediate",
      estimatedTime: 35,
      description: "Learn baiting techniques and audio manipulation to outsmart opponents.",
      prerequisites: ["pvp4"],
    },
    {
      tutorialSlug: "pvp8",
      order: 5,
      tier: "advanced",
      estimatedTime: 50,
      // Corrected from the source's stale "Master jump shot mechanics..."
      // description - pvp8's real article is about combining every
      // technique into fluid combat sequences by engagement range, not
      // jump shots (see the plan's decision #3 for the full discrepancy).
      description:
        "Combine every movement technique into fluid combat sequences, matched to engagement range and environment.",
      prerequisites: ["pvp5"],
    },
    {
      tutorialSlug: "pvp9",
      order: 6,
      tier: "advanced",
      estimatedTime: 40,
      // Corrected from the source's stale "Put it all together with mastery
      // integration..." description - pvp9's real article is about weight
      // classes, loadout archetypes, and equipment selection.
      description:
        "Optimize your loadout's weight class, weapon choice, and keybinds for maximum movement effectiveness.",
      prerequisites: ["pvp8"],
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

/** `currentSlug`'s 1-based position in the path, matching `getNextTutorialInPath`'s use of `notFound()`-safe fallbacks: an unknown slug reports `0 of N`. */
export function getTutorialProgressInPath(currentSlug: string): {
  current: number;
  total: number;
  percentage: number;
} {
  const path = getPvpLearningPathWithTutorials();
  const index = path.findIndex((item) => item.tutorialSlug === currentSlug);
  const total = path.length;
  if (index === -1) return { current: 0, total, percentage: 0 };
  const current = index + 1;
  return { current, total, percentage: Math.round((current / total) * 100) };
}
