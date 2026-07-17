export interface CondensedGuideSection {
  tutorialSlug: string;
  order: number;
  title: string;
  briefExplanation: string;
  /** Only set for `pvp1` - see the doc comment below. */
  videoPath?: string;
  keyPoints: readonly string[];
}

/**
 * Quick-start summaries for the "Quick Start" tab - ported from
 * `old/tarkov-tips/src/data/pvp-condensed-guide.ts`'s `pvpCondensedGuide`,
 * with two real bugs fixed rather than reproduced (plan's decision #3):
 *
 * 1. The source's `pvp8`/`pvp9` entries still carry a literal
 *    `"[Content to be written: ...]"` placeholder describing jump shots and
 *    mastery-integration training - content that was never written under
 *    those slugs. What actually shipped as `pvp8.mdx`/`pvp9.mdx` covers
 *    combat technique integration and equipment/weight optimization
 *    instead (pvp6/pvp7 were skipped and pvp8/9 absorbed different
 *    topics). Rewritten below to match the real articles.
 * 2. Every source entry reused the exact same one video
 *    (`a-d-strafing-comparison.webm`) regardless of topic, and two other
 *    referenced clips were 0-byte stub files. Only `pvp1`'s article
 *    actually has a real, on-topic demo video - `videoPath` is only set on
 *    its entry here; the rest render without a video block at all rather
 *    than a mismatched one (`CondensedGuideSection` only shows the video
 *    section when `videoPath` is present).
 */
export const PVP_CONDENSED_GUIDE: readonly CondensedGuideSection[] = [
  {
    tutorialSlug: "pvp1",
    order: 1,
    title: "Movement: Circular Strafing",
    briefExplanation:
      "Tarkov's inertia system creates dangerous vulnerability windows when you change direction due to the halts when you completely reverse your velocity. Your character must stop completely before reversing, leaving you exposed. The solution is quite simple: move in tiny circles. Since you'll be changing your direction in 90-degree intervals instead of 180-degree intervals. The below video shows the difference between standard A-D strafing (with those stalls at each end) vs the fluid circular strafing. This allows you to maintain consistent movement & is the foundation of all movement, utilized quite often in the following tips",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    keyPoints: [
      "Use circular patterns instead of A-D strafing",
      "Drop your backpack before combat engagements to reduce the total inertia",
      "Stay underweight (white weight, not yellow/red) for optimal movement speed",
      "Practice in arena, offline raids, or your shooting range to build muscle memory",
      "Use clipping software like Medal or Outplayed to record and review your deaths to identify movement mistakes",
    ],
  },
  {
    tutorialSlug: "pvp3",
    order: 2,
    title: "Crosshair Placement & Pre-Aiming",
    briefExplanation:
      "Tarkov gunfights are primarily decided by preparation, not reaction. Keeping your crosshair at head height and pre-aiming common angles ensures your shots land instantly when enemies appear. Anticipate wide swings, maintain aim discipline through movement, and always position your sights where the head will be.",
    keyPoints: [
      "Always keep crosshair at head height",
      "Pre-aim common angles before peeking",
      "Maintain crosshair discipline during movement",
      "Know high-traffic areas for each map",
      "Proper crosshair placement wins fights before they start",
    ],
  },
  {
    tutorialSlug: "pvp4",
    order: 3,
    title: "Peeking Mechanics - Intel & Combat",
    briefExplanation:
      "Tarkov peeking mechanics reward precision and unpredictability. By understanding right-hand advantage, mastering circular and jump peeks, and varying head height between exposures, you can gather intel safely and control fights before they start.",
    keyPoints: [
      "Right-hand peeks expose less of your body and should always be prioritized over left-hand angles",
      "Lean peeking provides controlled visibility but is limited by inertia when moving between cover",
      "Circle peeking maintains fluid motion and minimizes exposure while gathering intel",
      "Jump peeking adds vertical unpredictability and helps reposition safely from left-hand to right-hand corners",
      "Vary peek timing, type, and head height to break enemy pre-aim and win unpredictable engagements",
    ],
  },
  {
    tutorialSlug: "pvp5",
    order: 4,
    title: "Baiting & Audio Manipulation",
    briefExplanation:
      "Baiting is about forcing your opponent to give up information before you commit. Through barrel baits, sprint pressure, or animation cancels, you can trick enemies into exposing their location and weapon type while staying safe.",
    keyPoints: [
      "Barrel baiting safely draws enemy fire by exposing only the weapon barrel",
      "Flashlights can extend bait visibility and trigger premature enemy reactions",
      "Heal and grenade cancel baits exploit sound cues to lure enemies into pushing",
      "Sequential barrel baits can cause inexperienced players to waste ammo and open kill windows",
    ],
  },
  {
    tutorialSlug: "pvp8",
    order: 5,
    title: "Movement Integration in Combat",
    briefExplanation:
      "True mastery comes from combining every movement technique into one fluid combat flow instead of executing them in isolation - matching technique combinations to engagement range (close/medium/long) and adapting your approach for indoor vs. outdoor environments.",
    keyPoints: [
      "Chain techniques together (peek → reposition → engage) instead of using them one at a time",
      "Close-range fights favor circle peeks, jump shots, and immediate repositioning",
      "Medium/long-range fights reward patient positioning and environmental cover",
      "Indoor environments demand tighter sound discipline and rapid repositioning",
      "Build technique combinations progressively: master singles, then pairs, then full sequences",
    ],
  },
  {
    tutorialSlug: "pvp9",
    order: 6,
    title: "Equipment Optimization for Movement",
    briefExplanation:
      "Your loadout's total weight directly sets your movement ceiling - Tarkov splits gear weight into five effective tiers (ultra-light to ultra-heavy), each with its own speed, stamina, and inertia characteristics. Choosing a loadout archetype around your target weight class turns equipment selection into a real tactical decision.",
    keyPoints: [
      "Stay under 15kg for near-instant direction changes and fastest stamina regen",
      "25-35kg is the realistic 'standard raid weight' - expect noticeable inertia and adjust technique timing",
      "Above 35kg, movement techniques degrade significantly - plan tactics around it, don't fight it",
      "Drop or redistribute gear progressively as a raid develops to stay in your target weight class",
      "Match your loadout archetype (and keybinds) to the playstyle you actually intend to use",
    ],
  },
];
