# PvP Guide

A tiered (Essential → Intermediate → Advanced) PvP learning path: a "Quick Start" condensed
summary tab plus a "Full Guide" tab linking out to 6 in-depth tutorials. Ported entirely from
`old/tarkov-tips` - `old/TarkovTrackerWB-main` has no comparable content, per the user's explicit
instruction for this port.

**Self-contained, not dependent on a future Tutorials feature.** tarkov-tips's own guide links out
to a separate, multi-category tutorial catalog (`/tutorials/{slug}`) that this project hasn't built
yet. Rather than block on that or duplicate its scope, this feature owns its own MDX content and
compiler, with its own tutorial detail routes at `/pvp-guide/{slug}`. If a future Tutorials phase
happens, it's a separate effort.

## Ported from

- `old/tarkov-tips/src/data/{pvp-learning-path,pvp-condensed-guide}.ts` - tiered path + quick-start
  summary data → `lib/pvp-learning-path.ts` / `lib/pvp-condensed-guide.ts`.
- `old/tarkov-tips/src/lib/{pvp-learning-path,mdx,tutorials}.ts` - join/navigation logic and the MDX
  compile pipeline → `lib/pvp-learning-path.ts` / `lib/mdx.ts` / `lib/tutorial-content.ts`.
- `old/tarkov-tips/src/content/tutorials/{pvp1,pvp3,pvp4,pvp5,pvp8,pvp9}.mdx` - the 6 real,
  shipped-in-the-guide tutorials → `content/*.mdx`. Two more source files exist
  (`pvp10`/`pvp11` - map strategies, team coordination) but were never wired into the live guide;
  left out of this port to match what actually shipped, not the author's unfinished backlog.
- `old/tarkov-tips/src/components/pvp/*`, `src/components/tutorials/{AutoplayVideo,SkipToVideo}.tsx`
  - presentation, rewritten cleanly with this project's design system (`Card`/`Badge`/`Tabs`) rather
    than ported as-is.

## Real content bugs fixed during the port, not reproduced

1. **`pvp8`/`pvp9`'s condensed-guide summaries were stale placeholders** describing content that
   was never written under those slugs (`pvp6`/`pvp7` were skipped, and `pvp8`/`pvp9` ended up
   covering different topics than originally planned - confirmed via
   `old/tarkov-tips/_reference/pvp-tutorial-roadmap.md`). `lib/pvp-condensed-guide.ts` and
   `lib/pvp-learning-path.ts` carry rewritten summaries matching what the real articles cover
   (combat technique integration by engagement range; equipment/weight-class optimization).
2. **Every condensed-guide section reused the same one video** regardless of topic, and two other
   referenced clips were 0-byte stub files. Only `circle-strafing`'s article (`pvp1` in the source)
   has a real, on-topic demo - `public/videos/pvp-guide/a-d-strafing-comparison.webm` is the one
   real asset ported, attached only to that entry. The other 5 sections render with no video block
   rather than a mismatched one.
3. **`*[GIF PLACEHOLDER: ...]*` text markers** (17 across `pvp8`/`pvp9`) were dead stubs for art
   that was never produced - stripped during the port.
4. **`category` frontmatter dropped entirely**, not just corrected. The source mislabels 4 of its 6
   real files (`weapons`/`economy`/`maps`/`quests` instead of `pvp` - copy-paste errors); that field
   only mattered for filtering across tarkov-tips's multi-topic catalog, which this self-contained
   feature doesn't have. Every article here is definitionally PvP content, so the field had no
   purpose left to serve correctly.
5. **`getNextTutorialInPath`/`getPreviousTutorialInPath`/`getTutorialProgressInPath`** existed in
   the source but were never called from anywhere (dead code). `PvpTutorialPage` wires them up for
   real prev/next navigation and a progress bar on every tutorial page.

## Architecture

- **MDX pipeline**: `next-mdx-remote/rsc`'s `compileMDX` (`lib/mdx.ts`) + `gray-matter`/`reading-time`
  for frontmatter-only metadata reads (`lib/tutorial-content.ts`) that don't need a full compile.
  `content/*.mdx` files are feature-local (not a shared top-level `src/content/`). Both
  `lib/tutorial-content.ts` and `lib/mdx.ts` import the `server-only` package (a real first for this
  project - see `vitest.config.ts`'s `resolve.alias` for why that needed a small config addition to
  stay testable).
- **Routes**: `src/app/pvp-guide/page.tsx` (hub, thin wrapper around `PvpGuidePage`) and
  `src/app/pvp-guide/[slug]/page.tsx` (tutorial detail, `generateStaticParams` prerenders all 6 at
  build time, thin wrapper around `PvpTutorialPage`).
- **Prose styling**: `@tailwindcss/typography`'s `prose` class, re-pointed at this project's own
  design tokens in `globals.css` (`--tw-prose-*` → `--color-*`) rather than its default static gray
  palette, so compiled MDX content re-themes correctly across all 6 themes. Deliberately no
  `dark:prose-invert` - this project themes via `[data-theme]`, not Tailwind's separate dark-mode
  variant.
- No `store.ts`/`persistence/` - this feature has no user state to persist, it's pure content.

## Video production workflow

How real demo clips for this guide get produced and encoded, established across several sessions
of actually doing it (wiggle, gathering-intel, and the original circle-strafing clip) - follow this
rather than re-deriving settings from scratch next time. Motivation: the site runs on Vercel's free
Hobby tier (100GB/mo bandwidth), and video is by far the dominant bandwidth cost on this site, so
every setting below is chosen for that reason, not arbitrarily.

**1. Source footage.** The user records raw gameplay, trims/syncs it in DaVinci Resolve, and drops
the finished export(s) in `C:\Users\main\Videos\finished` (referred to as "the usual finished
folder"). For a two-POV comparison (player + enemy watching the same moment), DaVinci should export
both angles already trimmed to the same in/out range - **don't** try to reverse-engineer raw-source
`ffmpeg -ss` trim offsets from DaVinci timeline timecodes by hand; a real session hit a genuine
60-vs-120fps source-frame-rate ambiguity doing exactly that (see `HANDOFF.md`'s wiggle-video entry)
and switched to "have DaVinci export the already-aligned range directly" instead, which sidesteps
the ambiguity entirely.

**2. Always `ffprobe` both files first, before any encoding.** Confirms actual codec/resolution/
frame rate/duration rather than assuming:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,avg_frame_rate,codec_name \
  -show_entries format=duration,size -of default=noprint_wrappers=1 <file>
```

**Also eyeball the actual last frame of every raw DaVinci export before encoding**, don't just
trust the in/out range. DaVinci intermittently renders the export's final frame as the real footage
shrunk into a corner of the frame (aspect ratio kept, black everywhere else) instead of a full frame

- a one-frame render glitch, not a fade/transition. Hit on 3 of the 4 clips from the 2026-08-02
  session (`headHeightChange.mov`, `headHeightChangeEnemy.mov`, `jigglePeek.mov`), absent on the
  4th (`jigglePeekEnemy.mov`) - stochastic per-export, not tied to which POV or which side of a pair.
  Catch it with a quick frame extraction (`ffmpeg -i <file> -vf "select='gte(n\,<total-2>)'" -vsync 0
out-%02d.jpg`) and eyeball the last couple frames. **Fix by dropping the bad frame(s) with a lossless
  `-c copy -frames:v <n>` trim** (no need to re-encode) - and if it's a two-POV pair, trim _both_ sides
  by the same frame count even if only one shows the glitch, so `VideoCompareSlider`'s synced loop ends
  both clips on the same real moment instead of the untrimmed side getting cut short every loop once
  the shorter one fires `ended` first.

**3. Target format: WebM/VP9, muted, 30fps, variance-AQ, no alt-ref frames.**

```bash
ffmpeg -i <input> -vf scale=<width>:<height> -r 30 -c:v libvpx-vp9 -crf <value> -b:v 0 \
  -aq-mode 1 -deadline best -cpu-used 0 -an <output>.webm
```

- **Container/codec**: WebM/VP9 - good compression, near-universal modern browser support, already
  what every clip on this site uses.
- **`-an` (muted, no audio track)**: these are silent gameplay demo clips; there's no audio content
  worth keeping and it's pure wasted bytes.
- **30fps, not 60fps or 24fps**: 30fps is a clean 2:1 decimation from a 60fps capture source (no
  judder), meaningfully smaller than 60fps for content that doesn't need the extra smoothness, and
  wiggling/strafing motion reads _worse_ at 24fps without film-style motion blur to hide the judder
  from an uneven 60→24 (2.5:1) decimation.
- **`-aq-mode 1` (variance-based adaptive quantization) and `-deadline best -cpu-used 0`
  (slowest/best-quality encoding mode) are mandatory, not optional tuning** - added after the
  crosshair-placement clips (dim indoor corridor footage) shipped with visible blotchy
  macroblocking in the dark/low-contrast areas at the plain `-crf 34` baseline below. `-aq-mode 1`
  specifically pushes more bits toward low-variance regions (shadows, flat walls) instead of
  spending them where motion/detail already draws the eye, which is exactly the class of artifact
  that showed up; `-deadline best` (vs. the ffmpeg default `good`) spends much more encode time
  finding better rate-distortion decisions per block - slow (tens of seconds even for a 3s clip),
  but these are one-time production encodes, not runtime cost, so there's no reason not to.
  Confirmed via a real before/after frame-crop comparison (dark locker/shelf area, `crosshair-
placement-bad.webm`): visible blocking at the old baseline, smooth and near-indistinguishable
  from the source at `-crf 30 -aq-mode 1 -deadline best` (606KB vs. the source clip's blotchy
  249KB) - `-crf 30` alone without `-aq-mode 1` was still visibly worse, confirming this is a
  variance-allocation problem more than a plain bitrate one. Also re-verified with a mid-swing
  motion frame that this combination doesn't reintroduce the alt-ref ghosting regression below -
  it doesn't; `-aq-mode`/`-deadline` are unrelated knobs from `-auto-alt-ref`/`-lag-in-frames`.
- **Resolution and CRF - test empirically per clip, don't reuse one fixed value.** Start at 1280x720
  / CRF 34 and check the real output size _and_ a real dark-area frame crop, not just the size.
  Content complexity varies enormously: the wiggle clips' fast lean-strafing motion needed 960x540
  (dropping resolution, not just raising CRF) to stay a reasonable size, while the gathering-intel
  freelook-sprint clips stayed under 1MB _at full 720p_ because that motion is far less chaotic; the
  crosshair-placement clips (dim indoor lighting) needed CRF dropped to 30 (with `-aq-mode 1`) rather
  than a resolution change, since the artifact was shadow blotchiness, not overall softness. **Prefer
  dropping resolution over pushing CRF higher on a single clip** for high-motion content specifically
  - over-compressing at full resolution produces visible blur/blocking on complex motion, whereas a
    lower resolution at a healthy CRF stays clean. For dim/low-contrast content, prefer lowering CRF
    (with `-aq-mode 1` already on) over dropping resolution instead - the failure mode there is
    shadow-region blocking, which resolution doesn't fix. (Started at CRF 32-34 as "good quality," push
    to 36+ only if a specific clip's size genuinely demands it and a dark-frame check still looks clean.)
- **Never add `-auto-alt-ref 1 -lag-in-frames 25`** (VP9 lookahead/alt-ref frames). Tried once to
  improve compression efficiency on a high-motion clip - produced real, visible ghosting/smearing
  artifacts on fast motion with HUD overlay elements. Confirmed regression, reverted; don't
  reintroduce it for "better compression" without re-verifying this doesn't recur.

**4. Poster stills** (the click-to-play cover image, shown before a reader presses play - see
`VideoClip`/`VideoCompareSlider`'s `poster`/`leftPoster`/`rightPoster` props): grab the first frame
of the _already-encoded_ `.webm`, not the raw source:

```bash
ffmpeg -y -i <clip>.webm -frames:v 1 -q:v 3 <clip>-poster.jpg
```

**5. Naming/placement convention**, all under `public/videos/pvp-guide/`:

- Single clip: `<topic>.webm` (e.g. `a-d-strafing-comparison.webm`).
- Two-POV pair: `<topic>-player-pov.webm` / `<topic>-enemy-pov.webm` - **player is always the left
  side / `leftSrc`, enemy is always the right side / `rightSrc`** in `VideoCompareSlider`, matching
  every real pair shipped so far.
- Posters: same base name + `-poster.jpg` (e.g. `<topic>-player-pov-poster.jpg`).

**6. Wire into both places a topic appears**, not just one - the full tutorial page's MDX
(`content/<topic>.mdx`) _and_ the condensed Quick Start entry (`lib/pvp-condensed-guide.ts`'s
`videoPath`/`videoPoster` for a single clip, or `videoCompare` for a POV pair) both need updating,
plus dropping that entry's `videoCaption` "coming soon" disclaimer once the footage is real (see
either file's existing entries for the exact shape). Click-to-play, the side-by-side toggle, and the
viewport pop-out are all behavior baked into `VideoClip`/`VideoCompareSlider` themselves - a new
clip gets all of it for free, no per-video wiring needed beyond the props above.

**7. Always finish with the full verification sweep**: `npx vitest run`, `npx eslint . --max-warnings=0`,
`npx tsc --noEmit`, then a real `next dev` + Playwright pass confirming zero video network requests
before a click and the correct request(s) after - not just that the build compiles.

## Static image comparisons (`ImageCompareSlider`)

For a topic where the "before/after" is a single moment rather than motion (e.g.
`peeking-essentials`' right-hand-vs-left-hand exposure comparison), `ImageCompareSlider`
(`components/ImageCompareSlider.tsx`) is `VideoCompareSlider`'s sibling: the exact same
divider-drag/side-by-side-toggle/intro-reveal mechanics and layout, minus everything that only
exists to sequence video playback (no click-to-play gate, no loading state, no autoplay/loop-sync).
Assets live under `public/images/pvp-guide/` (parallel to `public/videos/pvp-guide/`), named
`<topic>-<what-differs>.jpg` (e.g. `peek-right-hand.jpg` / `peek-left-hand.jpg`) - resize/compress
with `sharp` (already a dependency) to roughly the same 1280x720 / <150KB ballpark real video posters
land at; there's no `ffmpeg` re-encode step to run since there's no video, just a still.

## Status

Implemented. `/pvp-guide` (hub, Quick Start + Full Guide tabs) and
`/pvp-guide/{circle-strafing,peeking-essentials,crosshair-placement,gathering-intel,wiggle,jump-shots}`
(tutorial detail pages with prev/next nav) are live, linked from the header nav and a real homepage
feature card. Renamed from the source's `pvp1`/`pvp3`/`pvp4`/`pvp5`/`pvp8`/`pvp9` numbering to
descriptive slugs after the port. `advanced-peeking-techniques`/`movement-integration`/
`equipment-optimization` (the old `pvp4`/`pvp8`/`pvp9`) were later superseded by this same
peeking-essentials/gathering-intel/wiggle/jump-shots split and deleted (2026-08-03), since nothing
in the site linked to them anymore.
