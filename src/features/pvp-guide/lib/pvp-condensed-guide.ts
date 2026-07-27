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
 *    Quick Start tab either. `baiting` and `wiggle` stay without a video
 *    block since their full pages aren't written yet.
 */
export const PVP_CONDENSED_GUIDE: readonly CondensedGuideSection[] = [
  {
    tutorialSlug: "circle-strafing",
    order: 1,
    title: "Movement: Circular Strafing",
    briefExplanation:
      "Tarkov's inertia system creates dangerous vulnerability windows when you change direction due to the halts when you completely reverse your velocity. Your character must stop completely before reversing, leaving you exposed. The solution is quite simple: move in tiny circles, which makes you move much more smoothly since you'll be changing your direction in 90-degree intervals instead of 180-degree intervals. The below video shows the difference between standard A-D strafing (with those stalls at each end) vs the fluid circular strafing. This allows you to maintain consistent movement & is the foundation of all movement, utilized quite often in the following tips",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    keyPoints: [
      "Use circular patterns instead of A-D strafing to eliminate 'scav stalls'",
      "Drop your backpack before combat engagements to reduce the total inertia",
      "Stay underweight (white weight, not yellow/red) for optimal movement speed",
      "Practice in arena, offline raids, or your shooting range to build muscle memory",
      "Use clipping software like Medal or Outplayed to record and review your deaths to identify movement mistakes",
    ],
  },
  {
    tutorialSlug: "peeking-essentials",
    order: 2,
    title: "Peeking Essentials",
    briefExplanation:
      "Staying alive in Tarkov PvP comes down to staying behind hard cover and exposing as little of yourself as possible every time you leave it - which starts with **prioritizing tight right-hand angles over left-hand ones**. Layer on jiggle peeking, hidden height changes, knowing when to swing instead of sit, and you be able to control the majority of pvp encounters.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption:
      "Placeholder clip - real footage of jiggle peeking, a hidden height change, and a wide swing is coming soon.",
    keyPoints: [
      "Prioritize tight right-hand angles - left-hand corners force you to expose your whole body before your gun even clears cover",
      "Rarely peek an angle the same way twice; lean on the [Gathering Intel](#gathering-intel) and [Baiting](#baiting) chapters so you rarely need to peek blind in the first place",
      "Jiggle peek by circling fully behind cover, leaning at the edge to peek out, and countering back in - keep your crosshair at head height the whole time",
      "Change your elevation (stand/crouch, rarely prone) while still behind cover so your next peek doesn't match your last one",
      "When you need to commit to a swing instead of jiggle peeks, swing wide with sprint momentum instead of walking out slowly - plus desync gives the swinging player a brief free window to shoot first",
    ],
  },
  {
    tutorialSlug: "crosshair-placement",
    order: 3,
    title: "Crosshair Placement & Pre-Aiming",
    briefExplanation:
      "Reaction speed in Tarkov isn't about reflexes - it's about how little your crosshair has to move once an enemy appears. Pre-aiming the most likely head-height spot, whether you're peeking, swinging, clearing a room, or just walking the map, turns a full reaction into a tiny correction. At extreme close range, a mounted laser lets you point-fire accurately without ever raising your sights.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption: "Placeholder clip - real footage of a pre-aimed peek and swing is coming soon.",
    keyPoints: [
      "Pre-aiming means less crosshair movement once an enemy appears - the biggest lever you have over your own reaction time",
      "Always pre-aim the most likely head-height spot when [jiggle peeking](/pvp-guide/peeking-essentials#jiggle-peeking-circular-movement-applied), [wide swinging](/pvp-guide/peeking-essentials#wide-swings-committing-with-momentum), or clearing a room",
      "This applies even when you're not aiming at all - players can be ratting anywhere, so keep your crosshair at head height while looting and rotating too",
      "Looking at the ground while looting is one of the most common ways players get caught off guard",
      "Mount a tactical device (laser/flashlight) so you can point-fire from the hip at extreme close range instead of losing time to ADS",
    ],
  },
  {
    tutorialSlug: "gathering-intel",
    order: 4,
    title: "Gathering Intel",
    briefExplanation:
      "Gathering intel means learning where the enemy is before you ever commit to a fight, so your peek or swing becomes a prefire instead of a guess. A freelook sprint timed with a jump gets you a look across an opening while keeping a blind prefire off your head, and a barrel poke into a doorway can bait that same information out of them. When you can't get a visual at all, audio cues and forcing a response fill in the rest.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption:
      "Placeholder clip - real footage of a freelook sprint and a barrel poke is coming soon.",
    keyPoints: [
      "Time a sprint across an opening with a jump so its peak lines up with the doorway's middle - a blind prefire lands on your legs or stomach instead of your head",
      "The same freelook sprint doubles as a way off a left-hand angle, since it gets you a look at the area while carrying you straight through to the right-hand side",
      "A barrel poke - circling just far enough into a doorway to expose your gun - baits a prefire that reveals the enemy's position, and their gun's sound can tell you its magazine size, damage, and penetration; the [Baiting](#baiting) chapter goes deeper on using this deliberately",
      "Automatic audio cues - footsteps, reloads, heals, and the 90-degree foot-pivot when you change look direction - reveal the enemy even when you can't see them",
      "Force a response when the enemy gives you nothing: a grenade down a hallway pressures them into repositioning, and VOIP or a voiceline can bait a reply that gives away their position",
    ],
  },
  {
    tutorialSlug: "baiting",
    order: 5,
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
    tutorialSlug: "wiggle",
    order: 6,
    title: "Wiggle",
    briefExplanation:
      "The wiggle isn't a new mechanic - it's the circular movement from the movement chapter with leans layered on top, following the same lean-into-your-movement rule as jiggle peeking. Lean right while circling right, flip to a left lean the instant your circle carries you back left, and keep that rhythm going while you're exposed and shooting. Done right, it moves you across the enemy's screen far faster than it feels like you're moving on your own end.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption:
      "Placeholder clip - real footage of a wiggle, shown from the enemy's POV, is coming soon.",
    keyPoints: [
      "Lean the same direction you're already moving, and flip the lean instantly the moment your circle sends you the other way",
      "The lean rides on top of your circle strafe rather than replacing it",
      "Moves you across the enemy's screen much faster than it feels like you're moving on your own end, making you significantly harder to aim at and track",
      "Use it any time you're exposed in the open and actively shooting, whether ADS'd or point firing - it's not a peek, it's how you move once you're already committed to a fight",
    ],
  },
  {
    tutorialSlug: "jump-shots",
    order: 7,
    title: "Jump Shots",
    briefExplanation:
      "A jump shot is primarily used for one'traditionally chains a sprint-jump into a second regular jump - sprint in a straight line, jump, release Shift, then jump again right as you land - to cross an opening while changing your head height mid-air. Your gun points at the ground during the sprint-jump phase and only readies up on the second jump, so timing is everything: land with your gun still down in the open and you're an easy kill instead of a hard target.",
    videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm",
    videoCaption: "Placeholder clip - dedicated jump shot footage is coming soon.",
    keyPoints: [
      "Chain a sprint-jump (W+Shift+Space) into a second regular jump on landing - the first jump builds momentum, the second readies your weapon",
      "Your barrel points at the ground during the sprint-jump phase - time the second jump so your gun is up before you're visible, not after",
      "Jump distance scales with sprint duration - 1-2 seconds of straight-line sprint before jumping gives max distance; strafing with A/D first shortens it",
      "You can adjust distance mid-air - holding W+Shift the whole way maximizes it, tapping S shortens it for a more precise landing",
      "Watch ceiling heights and door frames before committing, then strafe immediately after landing so you're never a stationary target",
    ],
  },
];
