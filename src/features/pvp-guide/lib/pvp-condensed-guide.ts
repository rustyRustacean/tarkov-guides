export interface CondensedGuideSection {
  tutorialSlug: string;
  order: number;
  title: string;
  briefExplanation: string;
  /** Real, on-topic demo footage only for `circle-strafing` - unset elsewhere. */
  videoPath?: string;
  /**
   * Shown under the video when `videoPath` is set. Left unset for
   * `circle-strafing` (its clip is real footage, needs no disclaimer); set to
   * a "coming soon" note everywhere else, since those entries reuse that same
   * clip as a stand-in the way their full tutorial pages already do.
   */
  videoCaption?: string;
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
 *    those slugs. What actually shipped as `movement-integration.mdx`/
 *    `equipment-optimization.mdx` (renamed from `pvp8`/`pvp9`) covers
 *    combat technique integration and equipment/weight optimization
 *    instead (pvp6/pvp7 were skipped and pvp8/9 absorbed different
 *    topics). Rewritten below to match the real articles.
 * 2. Every source entry reused the exact same one video
 *    (`a-d-strafing-comparison.webm`) regardless of topic, with no
 *    disclaimer that it didn't match, and two other referenced clips were
 *    0-byte stub files. Only `circle-strafing`'s article (renamed from
 *    `pvp1`) actually has a real, on-topic demo video, so for a while this
 *    file only set `videoPath` on that one entry and left the rest with no
 *    video block at all.
 *
 *    `peeking-essentials`/`crosshair-placement`/`gathering-intel`/
 *    `jump-shots` now reuse that same clip as a placeholder too, matching
 *    each one's full tutorial page (`content/*.mdx`), which already embeds
 *    it with a "coming soon" caption. `videoCaption` carries that same
 *    disclaimer here so the reused clip doesn't read as real footage on the
 *    Quick Start tab either.
 *
 * `baiting` was folded into `gathering-intel` 2026-07-29 - one combined
 * chapter covers both now (`content/gathering-intel.mdx`), so this file's
 * own `baiting` entry is gone rather than kept as a redirect/duplicate.
 */
export const PVP_CONDENSED_GUIDE: readonly CondensedGuideSection[] = [
  {
    tutorialSlug: "circle-strafing",
    order: 1,
    title: "Movement: Circular Strafing",
    briefExplanation:
      "Tarkov's inertia system creates dangerous vulnerability windows as your character must stop completely before reversing, leaving you exposed. The solution is quite simple: move in tiny circles, which makes you move much more smoothly since you'll be changing your direction in 90-degree intervals instead of 180-degree intervals. The below video shows the difference between standard A-D strafing (with those stalls at each end) vs the fluid circular strafing. This allows you to maintain consistent movement & is the foundation of all movement, utilized quite often in the following tips",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    keyPoints: [
      "Use circular patterns instead of A-D strafing to eliminate 'scav stalls'",
      "Drop your backpack before combat engagements to reduce the total inertia",
      "Stay underweight (white weight, not yellow/red) for optimal movement speed",
      "Use clipping software like Medal or Outplayed to record and review your deaths to identify movement mistakes",
    ],
  },
  {
    tutorialSlug: "peeking-essentials",
    order: 2,
    title: "Peeking Essentials",
    briefExplanation:
      "Staying alive in Tarkov comes down to staying behind hard cover and exposing as little of yourself as possible, which starts with **prioritizing tight right-hand angles over left-hand ones**. Layer on jiggle peeking, hidden height changes, knowing when to swing instead of sit, and you be able to control the majority of pvp encounters.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption:
      "Placeholder clip - real footage of jiggle peeking, a hidden height change, and a wide swing is coming soon.",
    keyPoints: [
      "Prioritize tight right-hand angles over left-hand corners whenever you can",
      "Save shoulder transitions for when you're truly forced onto a left-hand angle - needing one usually means an earlier mistake, and it still can't match a real right-hand angle",
      "Jiggle peek properly by circling behind cover, then lean out and counter back in",
      "Change your head height behind cover so your next peek looks different",
      "Swing wide with sprint momentum instead of walking out slowly",
      "Swing when you're stuck on a bad angle or already spotted; hold when you're on a strong right-hand position",
      "Against AI, keep angles even tighter and back off after a failed peek to let their aggression cool down",
      "Prone rarely, and mask the sound of dropping with a gunshot if you do",
    ],
  },
  {
    tutorialSlug: "crosshair-placement",
    order: 3,
    title: "Crosshair Placement & Pre-Aiming",
    briefExplanation:
      "Pre-aiming the most likely head-height spot consistenly throughout the raid noticeably increases your survival against any surprises. The less you have to move your gun after seeing your enemy, the faster your average TTK will be.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption: "Placeholder clip - real footage of a pre-aimed peek and swing is coming soon.",
    keyPoints: [
      "Pre-aim head height so your crosshair barely has to move once they appear",
      "Pre-aim throughout the entire raid, not just when expected",
      "When clearing a room, always aim where you're exposing yourself & pre-aim the angle before you even leave your cover.",
      "If this is new to you, proper head height crosshair placement will feel uncomfortably high.",
    ],
  },
  {
    tutorialSlug: "gathering-intel",
    order: 4,
    title: "Gathering Intel & Baiting",
    briefExplanation:
      "Gathering intel means learning where the enemy is before you ever commit to a fight, so your peek or swing becomes a prefire instead of a guess. A freelook sprint timed with a jump gets you a look across an opening (ideally from a left-hand to a right-hand angle) while keeping a blind prefire off your head, and a barrel poke into a doorway - flashlight-extended or not - can bait that same information out of them. When you can't get a visual at all, audio cues and forcing a reaction (a grenade, VOIP, a canceled heal or grenade animation) fill in the rest.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption:
      "Placeholder clip - real footage of a freelook sprint and a barrel poke is coming soon.",
    keyPoints: [
      "Time a sprint+jump+freelook so you can cross a doorway/hallway safely while still gathering information.",
      "Poke your barrel into an uncleared area while moving in circles to bait a prefire that reveals their position",
      "Extend a barrel poke with your flashlight to exaggerate your presence, but never leave it on into a wide swing",
      "Footsteps, reloads, heals, and foot-pivots all reveal the enemy through sound",
      "Force a reaction with a grenade, VOIP, or a voiceline - or bait with your own canceled heal/grenade animation",
      "Repeating the same poke or sprint against a beginner can bait a panicked, wasted magazine",
    ],
  },
  {
    tutorialSlug: "wiggle",
    order: 5,
    title: "Wiggle",
    briefExplanation:
      "The wiggle is just leaning applied to your circular movement we learned earlier in the guide. Always wiggle when you're exposed (not holding an angle). Lean right while moving right, left while you're moving left & it will move you across the enemy's screen far faster than it appears to you.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption:
      "Placeholder clip - real footage of a wiggle, shown from the enemy's POV, is coming soon.",
    keyPoints: [
      "Lean the same direction you're moving, flipping instantly when your circle reverses",
      "Use it any time you're exposed and shooting, whether ADS'd or point firing",
    ],
  },
  {
    tutorialSlug: "jump-shots",
    order: 6,
    title: "Jump Shots",
    briefExplanation:
      "Just a fun way to farm a clip, chain a sprint-jump into a second regular jump (the first builds speed, the second raises your gun back up since it points at the ground while sprinting) & fire a short burst at the peak of the jump. Additionally, you can reverse your direction the moment you land instead of continuing the way you were already moving to increase unpredictability via throwing off your opponents tracking.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption: "Placeholder clip - dedicated jump shot footage is coming soon.",
    keyPoints: [
      "Chain a sprint-jump into a second regular jump to increase the speed of your jump shot",
      "Fire a single shot or short burst right at the peak of the jump",
      "Reverse direction the instant you land instead of continuing the same way",
      "Tapping right-click immediately before you sprint-jump raises your gun similar to a normal jump shot (if you use hold-to-ADS)",
    ],
  },
];
