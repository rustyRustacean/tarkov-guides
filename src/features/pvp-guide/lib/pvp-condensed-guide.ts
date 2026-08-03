export interface CondensedGuideSection {
  tutorialSlug: string;
  order: number;
  title: string;
  briefExplanation: string;
  /** Real, on-topic demo footage for `circle-strafing`, `wiggle`, and `gathering-intel` - unset (falls back to the shared placeholder clip) elsewhere. */
  videoPath?: string;
  /**
   * Click-to-play cover image shown before `videoPath` starts (see
   * `VideoClip`'s `poster` prop) - the first frame of the clip's own
   * player-POV footage where one exists, so the cover reads as a real
   * preview rather than a generic placeholder. Unset falls back to
   * `VideoClip`'s plain icon-on-muted-background default.
   */
  videoPoster?: string;
  /**
   * Shown under the video when `videoPath` is set. Left unset for entries
   * with real, on-topic footage (`circle-strafing`, `wiggle`,
   * `gathering-intel` - need no disclaimer); set to a "coming soon" note for
   * entries still reusing the shared placeholder clip as a stand-in, the way
   * their full tutorial pages already do.
   */
  videoCaption?: string;
  /**
   * Real player-vs-enemy POV pair for the same clip - renders as a
   * `VideoCompareSlider` (drag divider + side-by-side toggle) instead of a
   * single `VideoClip`, mirroring what the entry's full tutorial page
   * already embeds. Mutually exclusive with `videoPath`/`videoPoster`/
   * `videoCaption` in practice (only one video representation is ever set
   * per entry) - set for `wiggle` and `gathering-intel`, unset elsewhere.
   */
  videoCompare?: {
    leftSrc: string;
    rightSrc: string;
    leftAlt: string;
    rightAlt: string;
    leftLabel?: string;
    rightLabel?: string;
    leftPoster?: string;
    rightPoster?: string;
    caption?: string;
  };
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
 *    `peeking-essentials` still reuses that same clip as a placeholder,
 *    matching its full tutorial page (`content/peeking-essentials.mdx`),
 *    which already embeds it with a "coming soon" caption. `videoCaption`
 *    carries that same disclaimer here so the reused clip doesn't read as
 *    real footage on the Quick Start tab either.
 *
 * `baiting` was folded into `gathering-intel` 2026-07-29 - one combined
 * chapter covers both now (`content/gathering-intel.mdx`), so this file's
 * own `baiting` entry is gone rather than kept as a redirect/duplicate.
 *
 * **Real footage added for `wiggle` and `gathering-intel` (2026-07-31)**,
 * each now using `videoCompare` to embed the same player-vs-enemy POV pair
 * (with matching `leftPoster`/`rightPoster` first-frame stills) their full
 * tutorial page already does, rather than a single `videoPath` clip -
 * `videoCaption` dropped for both, same as `circle-strafing`.
 *
 * **Real footage added for `jump-shots` (2026-07-31)** - a single clip (the
 * victim's POV of getting killed by one, not a player-vs-enemy pair), so it
 * keeps the plain `videoPath`/`videoPoster` shape rather than switching to
 * `videoCompare`. `videoCaption` dropped, same as the others above.
 *
 * **Real footage added for `crosshair-placement` (2026-07-31)** - a
 * bad-habit-vs-good-habit pair (not a player-vs-enemy POV pair like
 * `wiggle`/`gathering-intel`), so `videoCompare` holds the same swing shown
 * with a center-mass pre-aim (`leftSrc`, "Bad") and a head-height pre-aim
 * (`rightSrc`, "Good") instead. `videoCaption` dropped, same as the others
 * above.
 *
 * **Real footage added for `peeking-essentials` (2026-08-02)** - swaps the
 * placeholder `videoPath` for a real player-vs-enemy `videoCompare` pair.
 * First pointed at the "Changing Head Height Behind Cover" footage (same day
 * that clip was shot), then re-pointed at the jiggle-peek player-vs-enemy
 * pair instead once that footage existed too - jiggle peeking is this
 * chapter's default, most-used technique (see "Jiggle Peeking: Circular
 * Movement Applied" on the full tutorial page), so it's the more
 * representative single clip for the Quick Start summary. The head-height
 * clip itself is unaffected and still lives on the full tutorial page's
 * "Changing Head Height Behind Cover" section - only this summary entry's
 * choice of *which* real clip to show changed. `videoCaption` dropped, same
 * as the others above.
 */
export const PVP_CONDENSED_GUIDE: readonly CondensedGuideSection[] = [
  {
    tutorialSlug: "circle-strafing",
    order: 1,
    title: "Movement: Circular Strafing",
    briefExplanation:
      "Tarkov's inertia system creates dangerous vulnerability windows as your character must stop completely before reversing, leaving you exposed. The solution is quite simple: move in tiny circles, which makes you move much more smoothly since you'll be changing your direction in 90-degree intervals instead of 180-degree intervals. The below video shows the difference between standard A-D strafing (with those stalls at each end) vs the fluid circular strafing. This allows you to maintain consistent movement & is the foundation of all movement, utilized quite often in the following tips",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoPoster: "/videos/pvp-guide/a-d-strafing-comparison-poster.jpg",
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
    videoCompare: {
      leftSrc: "/videos/pvp-guide/jiggle-peek-player-pov.webm",
      rightSrc: "/videos/pvp-guide/jiggle-peek-enemy-pov.webm",
      leftAlt:
        "The peeker's own POV during a tight jiggle peek, lean-and-counter-lean around cover",
      rightAlt:
        "The enemy's POV of the same jiggle peek - the peeker is barely visible even at the edge of the lean",
      leftLabel: "Peeker",
      rightLabel: "Enemy",
      leftPoster: "/videos/pvp-guide/jiggle-peek-player-pov-poster.jpg",
      rightPoster: "/videos/pvp-guide/jiggle-peek-enemy-pov-poster.jpg",
      caption:
        "Same jiggle peek, two POVs - a tight lean like this barely clears cover on the enemy's screen, even though it feels like a full peek to the player throwing it.",
    },
    keyPoints: [
      "Prioritize tight right-hand angles over left-hand corners whenever you can",
      "Save shoulder transitions for when you're truly forced onto a left-hand angle. Needing one usually means an earlier mistake, and it still can't match a real right-hand angle",
      "Jiggle peek properly by circling behind cover, then lean out and counter back in",
      "Change your head height behind cover so your next peek looks different",
      "Swing wide with sprint momentum instead of walking out slowly",
      "Swing when you're stuck on a bad angle or already spotted; hold when you're on a strong right-hand position",
      "Against AI, keep angles even tighter and back off after a failed peek to let their aggression cool down",
    ],
  },
  {
    tutorialSlug: "crosshair-placement",
    order: 3,
    title: "Crosshair Placement & Pre-Aiming",
    briefExplanation:
      "Pre-aiming the most likely head-height spot consistenly throughout the raid noticeably increases your survival against any surprises. The less you have to move your gun after seeing your enemy, the faster your average TTK will be.",
    videoCompare: {
      leftSrc: "/videos/pvp-guide/crosshair-placement-bad.webm",
      rightSrc: "/videos/pvp-guide/crosshair-placement-good.webm",
      leftAlt: "Swinging an angle pre-aimed at center mass (the bad habit)",
      rightAlt: "Swinging the same angle pre-aimed at head height (the good habit)",
      leftLabel: "Bad",
      rightLabel: "Good",
      leftPoster: "/videos/pvp-guide/crosshair-placement-bad-poster.jpg",
      rightPoster: "/videos/pvp-guide/crosshair-placement-good-poster.jpg",
      caption:
        "Same swing, two crosshair habits. Pre-aiming center mass (left) means correcting upward after you spot them; pre-aiming head height (right) means firing the instant they appear.",
    },
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
      "Gathering intel means learning where the enemy is before you ever commit to a fight, so your peek or swing becomes a prefire instead of a guess. A freelook sprint timed with a jump gets you a look across an opening (ideally from a left-hand to a right-hand angle) while keeping a blind prefire off your head, and a barrel poke into a doorway (flashlight-extended or not) can bait that same information out of them. When you can't get a visual at all, audio cues and forcing a reaction (a grenade, VOIP, a canceled heal or grenade animation) fill in the rest.",
    videoCompare: {
      leftSrc: "/videos/pvp-guide/gathering-intel-player-pov.webm",
      rightSrc: "/videos/pvp-guide/gathering-intel-enemy-pov.webm",
      leftAlt: "The player's own POV sprinting across a doorway with freelook",
      rightAlt: "The enemy's POV of the same freelook sprint",
      leftLabel: "Player",
      rightLabel: "Enemy",
      leftPoster: "/videos/pvp-guide/gathering-intel-player-pov-poster.jpg",
      rightPoster: "/videos/pvp-guide/gathering-intel-enemy-pov-poster.jpg",
      caption:
        "Same freelook sprint, two POVs. Notice how little of the player is actually exposed to the enemy despite how much ground they cover.",
    },
    keyPoints: [
      "Time a sprint+jump+freelook so you can cross a doorway/hallway safely while still gathering information.",
      "Poke your barrel into an uncleared area while moving in circles to bait a prefire that reveals their position",
      "Extend a barrel poke with your flashlight to exaggerate your presence, but never leave it on into a wide swing",
      "Footsteps, reloads, heals, and foot-pivots all reveal the enemy through sound",
      "Force a reaction with a grenade, VOIP, or a voiceline, or bait with your own canceled heal/grenade animation",
      "Repeating the same poke or sprint against a beginner can bait a panicked, wasted magazine",
    ],
  },
  {
    tutorialSlug: "wiggle",
    order: 5,
    title: "Wiggle",
    briefExplanation:
      "The wiggle is just leaning applied to your circular movement we learned earlier in the guide. Always wiggle when you're exposed (not holding an angle). Lean right while moving right, left while you're moving left & it will move you across the enemy's screen far faster than it appears to you.",
    videoCompare: {
      leftSrc: "/videos/pvp-guide/wiggle-player-pov.webm",
      rightSrc: "/videos/pvp-guide/wiggle-enemy-pov.webm",
      leftAlt: "The wiggling player's own POV, mid-wiggle",
      rightAlt: "The enemy's POV watching the same wiggle",
      leftLabel: "Player",
      rightLabel: "Enemy",
      leftPoster: "/videos/pvp-guide/wiggle-player-pov-poster.jpg",
      rightPoster: "/videos/pvp-guide/wiggle-enemy-pov-poster.jpg",
      caption:
        "Same wiggle, two POVs. Your own movement always feels smaller and slower than it looks to the enemy, which is exactly why it's so hard for them to track.",
    },
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
    videoPath: "/videos/pvp-guide/jump-shot-victim-pov.webm",
    videoPoster: "/videos/pvp-guide/jump-shot-victim-pov-poster.jpg",
    keyPoints: [
      "Chain a sprint-jump into a second regular jump to increase the speed of your jump shot",
      "Fire a single shot or short burst right at the peak of the jump",
      "Reverse direction the instant you land instead of continuing the same way",
      "Tapping right-click immediately before you sprint-jump raises your gun similar to a normal jump shot (if you use hold-to-ADS)",
    ],
  },
];
