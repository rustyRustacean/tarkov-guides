"use client";

import { ChevronsLeftRight, Columns2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { assetPath } from "@/shared/lib/asset-cdn";
import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { cn } from "@/shared/ui/lib/cn";

import { useInViewport } from "../hooks/use-in-viewport";
import {
  INTRO_REVEAL_PERCENT,
  MAX_PERCENT,
  MIN_PERCENT,
  nextPercentFromKey,
  percentFromClientX,
} from "../lib/video-compare-slider";

import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

/** Same bar as `VideoClip`'s: roughly on screen is enough to be worth decoding/playing both clips. */
const AUTOPLAY_VISIBILITY_THRESHOLD = 0.25;
/** Deliberately near-1, not exactly 1: the whole point is "the reader can actually see the whole comparison," not a technicality about one clipped pixel. */
const INTRO_VISIBILITY_THRESHOLD = 0.98;
const INTRO_DELAY_MS = 500;
/** Side-by-side mode's pop-out width cap (see the `<figure>` style below) - generous enough to make real use of a 4K+ display without a single 32:9 video card ever becoming absurdly, distortingly huge on an ultrawide/8K one. */
const SIDE_BY_SIDE_MAX_WIDTH_PX = 2400;

interface Props {
  leftSrc: string;
  rightSrc: string;
  leftAlt: string;
  rightAlt: string;
  /** Small badge over the left video (e.g. "Peeker's POV"). Omit for no label. */
  leftLabel?: string;
  /** Small badge over the right video (e.g. "Enemy's POV"). Omit for no label. */
  rightLabel?: string;
  /** Optional static still shown (clipped, same as the video it stands in for) behind the click-to-play cover. Falls back to a plain shared muted-background panel when omitted. */
  leftPoster?: string;
  /** Optional static still for the right side - see `leftPoster`. */
  rightPoster?: string;
  caption?: string;
  className?: string;
}

/**
 * A draggable left/right video comparison - the same "before/after slider"
 * pattern used everywhere for image diffs, adapted for two independently
 * sourced but synced-playback video clips (e.g. the same peek shown from
 * the peeker's and the defender's POV). The left clip is the top layer,
 * clipped to `position`% of the frame via `clip-path`; the right clip is
 * the always-full-size base layer underneath, so the two never need to
 * know their own pixel width - `clip-path`'s percentages resolve against
 * the element's own box, unlike the width%-of-container technique some
 * comparison sliders use (which needs the outer container's pixel width to
 * size the inner media, via a resize observer or container query units).
 *
 * Click-to-play: neither clip downloads or plays until the reader clicks
 * the single shared "Play comparison" affordance (`preload="none"` on both
 * `<video>`s) - since this is a *synced* comparison, starting only one side
 * would be meaningless, so there's one combined trigger for both, not two
 * independent ones. Once started, both clips are muted/looped/visibility-
 * gated exactly like `VideoClip` - but looped manually (`ended`, not the
 * `loop` attribute), so two clips of slightly different lengths can't drift
 * out of sync loop after loop the way two independently-`loop`ing videos
 * would.
 *
 * `viewMode` toggles between this default overlay/slider comparison and a
 * side-by-side layout (both clips shown at once, each at half width, no
 * clip-path/divider) - a small button in the top-center of the card flips
 * between the two. Both modes share the exact same two `<video>` elements
 * (only their wrapping `<div>`s' position/width classes and the left
 * wrapper's `clip-path` change) rather than mounting separate elements per
 * mode, so toggling never interrupts playback or forces a reload.
 *
 * The divider itself, and the intro-reveal animation below, are
 * deliberately independent of both click-to-play and clip-readiness - they
 * render and animate over a static backdrop (poster images if provided,
 * otherwise a plain shared muted panel) so a reader who scrolls the card
 * into view and never clicks still gets taught the drag affordance, which
 * is the entire point of the reveal: the divider starts at 50/50 (so the
 * page shows an unmistakable "split view" the instant it's scrolled
 * anywhere into view, even mid-scroll), then - once the *whole* card is on
 * screen - eases over to `INTRO_REVEAL_PERCENT`. It resets back to 50/50
 * once the card scrolls out of view again (`AUTOPLAY_VISIBILITY_THRESHOLD`,
 * the same "roughly on/off screen" line `VideoClip` autoplay uses) so the
 * next time it's scrolled back into view - later in the same page, or a
 * fresh visit entirely - it re-teaches the same affordance instead of
 * silently sitting at `INTRO_REVEAL_PERCENT` with nothing left to reveal.
 * `hasUserInteractedRef` is the one-way opt-out: the moment a reader drags
 * or keyboard-nudges the divider themselves, both the reset and the reveal
 * stop entirely for the rest of this mount - we should never fight a
 * position they set on purpose.
 */
export function VideoCompareSlider({
  leftSrc,
  rightSrc,
  leftAlt,
  rightAlt,
  leftLabel,
  rightLabel,
  leftPoster,
  rightPoster,
  caption,
  className,
}: Props) {
  const resolvedLeftSrc = assetPath(leftSrc);
  const resolvedRightSrc = assetPath(rightSrc);
  const resolvedLeftPoster = leftPoster ? assetPath(leftPoster) : undefined;
  const resolvedRightPoster = rightPoster ? assetPath(rightPoster) : undefined;

  const leftVideoRef = useRef<HTMLVideoElement>(null);
  const rightVideoRef = useRef<HTMLVideoElement>(null);
  const leftClipRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const hasUserInteractedRef = useRef(false);

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(50);
  const [viewMode, setViewMode] = useState<"overlay" | "sideBySide">("overlay");

  const prefersReducedMotion = usePrefersReducedMotion();
  const isVisible = useInViewport(containerEl, AUTOPLAY_VISIBILITY_THRESHOLD);
  const isFullyVisible = useInViewport(containerEl, INTRO_VISIBILITY_THRESHOLD);

  const suppressTransition = isDragging || prefersReducedMotion;
  const isShowingVideo = hasStarted && !isLoading;

  // Ready/error wiring - `isLoading` only clears once *both* clips can play.
  useEffect(() => {
    const left = leftVideoRef.current;
    const right = rightVideoRef.current;
    if (!left || !right) return;

    let leftReady = false;
    let rightReady = false;

    function checkBothReady(): void {
      if (leftReady && rightReady) setIsLoading(false);
    }
    function handleLoadStart(): void {
      setIsLoading(true);
    }
    function handleLeftCanPlay(): void {
      leftReady = true;
      checkBothReady();
    }
    function handleRightCanPlay(): void {
      rightReady = true;
      checkBothReady();
    }
    function handleError(): void {
      setIsLoading(false);
      setHasError(true);
    }

    left.addEventListener("loadstart", handleLoadStart);
    right.addEventListener("loadstart", handleLoadStart);
    left.addEventListener("canplay", handleLeftCanPlay);
    right.addEventListener("canplay", handleRightCanPlay);
    left.addEventListener("error", handleError);
    right.addEventListener("error", handleError);

    if (left.readyState >= 3) handleLeftCanPlay();
    if (right.readyState >= 3) handleRightCanPlay();

    return () => {
      left.removeEventListener("loadstart", handleLoadStart);
      right.removeEventListener("loadstart", handleLoadStart);
      left.removeEventListener("canplay", handleLeftCanPlay);
      right.removeEventListener("canplay", handleRightCanPlay);
      left.removeEventListener("error", handleError);
      right.removeEventListener("error", handleError);
    };
  }, []);

  // Visibility-gated synced autoplay - only decode/play while on screen (see
  // `VideoClip`), and keep both clips looping together (manual `ended`
  // handling instead of the native `loop` attribute, so whichever clip is
  // shorter can't drift ahead of the other loop after loop). Gated on
  // `hasStarted` so this can never itself trigger the first, bandwidth-
  // costing load - only `handleStart`'s direct click does that.
  useEffect(() => {
    const left = leftVideoRef.current;
    const right = rightVideoRef.current;
    if (!left || !right || !hasStarted || isLoading || hasError) return;

    if (!isVisible) {
      left.pause();
      right.pause();
      return;
    }

    const restartBoth = (): void => {
      left.currentTime = 0;
      right.currentTime = 0;
      void left.play().catch(() => undefined);
      void right.play().catch(() => undefined);
    };

    left.addEventListener("ended", restartBoth);
    right.addEventListener("ended", restartBoth);
    void left.play().catch(() => undefined);
    void right.play().catch(() => undefined);

    return () => {
      left.removeEventListener("ended", restartBoth);
      right.removeEventListener("ended", restartBoth);
    };
  }, [hasStarted, isVisible, isLoading, hasError]);

  /** The only place that ever triggers the first `.play()` on either clip - always a direct click on the single shared affordance, since starting just one side of a synced comparison would be meaningless. */
  function handleStart(): void {
    const left = leftVideoRef.current;
    const right = rightVideoRef.current;
    if (!left || !right) return;
    setHasStarted(true);
    void left.play().catch(() => undefined);
    void right.play().catch(() => undefined);
  }

  // Resets the divider back to center once the card scrolls (mostly) out of
  // view, so the next time it's scrolled back in there's a 50/50 starting
  // point to reveal from again - otherwise a reader who scrolls past this
  // card to a second one further down, then back up, would find the divider
  // already sitting at `INTRO_REVEAL_PERCENT` with nothing left to animate.
  // Skipped once the reader has taken the divider over themselves (see the
  // component doc comment) - we should never snap a position they set on
  // purpose back to center just because they scrolled away.
  useEffect(() => {
    if (isVisible || hasUserInteractedRef.current) return;
    setPosition(50);
  }, [isVisible]);

  // The reveal intro - every time the whole card is (re)scrolled fully into
  // view, not just the first. Deliberately independent of
  // `hasStarted`/`isLoading`: it animates over the static backdrop (see the
  // component doc comment), so a reader who never clicks play still gets
  // taught the drag affordance, each time they rediscover this card. Reduced
  // motion still gets the *reveal* (never requiring an action just to see it
  // is the whole point), just via a same-tick timeout instead of a delayed
  // one, so there's nothing to visually animate (`suppressTransition` also
  // turns off the CSS transition for these users).
  useEffect(() => {
    if (!isFullyVisible || hasUserInteractedRef.current) return;

    const timer = setTimeout(
      () => {
        setPosition(INTRO_REVEAL_PERCENT);
      },
      prefersReducedMotion ? 0 : INTRO_DELAY_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [isFullyVisible, prefersReducedMotion]);

  /** Imperative style write for the live-drag path - see `use-sheet-drag.ts` for why this bypasses `useState` mid-drag (avoids a React re-render on every pointer-move). `position` state is only committed at drag end. */
  function applyPosition(pct: number): void {
    if (leftClipRef.current) {
      leftClipRef.current.style.clipPath = `inset(0 ${String(100 - pct)}% 0 0)`;
    }
    if (dividerRef.current) {
      dividerRef.current.style.left = `${String(pct)}%`;
      dividerRef.current.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
  }

  function percentFromEvent(clientX: number): number | null {
    if (!containerEl) return null;
    return percentFromClientX(clientX, containerEl.getBoundingClientRect());
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragPointerIdRef.current = event.pointerId;
    hasUserInteractedRef.current = true;
    setIsDragging(true);
    const pct = percentFromEvent(event.clientX);
    if (pct !== null) applyPosition(pct);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (dragPointerIdRef.current !== event.pointerId) return;
    const pct = percentFromEvent(event.clientX);
    if (pct !== null) applyPosition(pct);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    if (dragPointerIdRef.current !== event.pointerId) return;
    dragPointerIdRef.current = null;
    setIsDragging(false);
    const pct = percentFromEvent(event.clientX);
    if (pct !== null) setPosition(pct);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const next = nextPercentFromKey(position, event.key);
    if (next === null) return;
    event.preventDefault();
    hasUserInteractedRef.current = true;
    setPosition(next);
  }

  if (hasError) {
    return (
      <div
        className={cn(
          "bg-muted border-border flex aspect-video w-full items-center justify-center rounded-xl border",
          className,
        )}
      >
        <div className="p-8 text-center">
          <p className="text-muted-foreground text-sm">Video failed to load</p>
        </div>
      </div>
    );
  }

  return (
    <figure
      className={cn(
        // See `VideoClip` for why this opts out of `.prose` entirely rather
        // than fighting its default figure/video margins.
        "not-prose bg-card border-border overflow-hidden rounded-xl border shadow-sm",
        !suppressTransition && "transition-all duration-700 ease-in-out",
        className,
      )}
      // Side-by-side mode "pops out" wider than the surrounding prose column
      // so two true 16:9 panels have real room instead of being squeezed
      // into the same width as the single-panel overlay view (which is
      // exactly what forces the object-cover crop this mode exists to
      // avoid) - and, unlike a fixed-pixel breakout, actually keeps scaling
      // up on very wide/4K+ displays instead of staying a tiny fraction of
      // the screen. `vw`-based width (not a percentage of this element's
      // own parent, which is only ever `max-w-3xl`/768px wide) is what
      // makes it track the real viewport instead of that fixed column.
      // `margin-left: 50%` + `translateX(-50%)` re-centers it on its
      // (centered) parent's midpoint - which is the viewport's midpoint,
      // since `PvpTutorialPage` centers that column with `mx-auto` - rather
      // than on the narrow column's own left edge, which a plain `width`
      // change alone would do.
      style={
        viewMode === "sideBySide"
          ? {
              width: `min(94vw, ${String(SIDE_BY_SIDE_MAX_WIDTH_PX)}px)`,
              marginLeft: "50%",
              transform: "translateX(-50%)",
            }
          : undefined
      }
    >
      <div
        ref={setContainerEl}
        className={cn(
          "bg-muted relative w-full touch-none select-none",
          !suppressTransition && "transition-[aspect-ratio] duration-700 ease-in-out",
        )}
        style={{ aspectRatio: viewMode === "overlay" ? "16 / 9" : "32 / 9" }}
      >
        {/* Right panel wrapper - full-width in overlay mode (the left
            clip's boundary is what actually reveals/hides it), the right
            half in side-by-side mode. `left`/`width` are explicit inline
            styles (not swapped Tailwind utility classes) specifically so
            `transition-all` has real animatable property values to
            interpolate between on a `viewMode` toggle, instead of an
            instant snap. */}
        <div
          className={cn(
            "absolute inset-y-0",
            !suppressTransition && "transition-all duration-700 ease-in-out",
          )}
          style={{
            left: viewMode === "overlay" ? "0%" : "50%",
            width: viewMode === "overlay" ? "100%" : "50%",
          }}
        >
          <video
            ref={rightVideoRef}
            aria-label={rightAlt}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ display: isShowingVideo ? "block" : "none" }}
            src={resolvedRightSrc}
            muted
            playsInline
            preload="none"
            poster={resolvedRightPoster}
            disablePictureInPicture
            disableRemotePlayback
          >
            Your browser does not support the video tag.
          </video>

          {!isShowingVideo && resolvedRightPoster && (
            // eslint-disable-next-line @next/next/no-img-element -- a small optional local still, not run through next/image, matching the plain-img convention already used for map/pvp-guide assets elsewhere in this feature.
            <img
              src={resolvedRightPoster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {rightLabel && (
            <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {rightLabel}
            </span>
          )}
        </div>

        {/* Left clip's clip boundary lives on this wrapper (not the <video>
            itself) so its label (and poster) gets clipped along with it as
            one unit - dragging the divider to 20% should hide the left
            label too, not leave it floating over now-revealed right-side
            content. In side-by-side mode the clip-path opens fully (there's
            nothing left to hide within this now-half-width box) while the
            wrapper itself shrinks to 50% - see the right wrapper above for
            why `left`/`width` are explicit inline styles, not swapped
            classes. */}
        <div
          ref={leftClipRef}
          className={cn(
            "absolute inset-y-0",
            !suppressTransition && "transition-all duration-700 ease-in-out",
          )}
          style={{
            left: "0%",
            width: viewMode === "overlay" ? "100%" : "50%",
            clipPath:
              viewMode === "overlay"
                ? `inset(0 ${String(100 - position)}% 0 0)`
                : "inset(0 0% 0 0)",
          }}
        >
          <video
            ref={leftVideoRef}
            aria-label={leftAlt}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ display: isShowingVideo ? "block" : "none" }}
            src={resolvedLeftSrc}
            muted
            playsInline
            preload="none"
            poster={resolvedLeftPoster}
            disablePictureInPicture
            disableRemotePlayback
          >
            Your browser does not support the video tag.
          </video>

          {!isShowingVideo && resolvedLeftPoster && (
            // eslint-disable-next-line @next/next/no-img-element -- see the matching comment on the right poster above.
            <img
              src={resolvedLeftPoster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {leftLabel && (
            <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {leftLabel}
            </span>
          )}
        </div>

        {hasStarted && isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-muted-foreground flex items-center gap-2">
              <div className="border-muted-foreground/40 border-t-muted-foreground h-6 w-6 animate-spin rounded-full border-2" />
              <span className="text-sm">Loading video...</span>
            </div>
          </div>
        )}

        {!hasStarted && (
          <button
            type="button"
            onClick={handleStart}
            className="absolute inset-0 z-[5] flex items-center justify-center"
            aria-label="Play comparison"
          >
            <span className="bg-background/90 hover:bg-background flex items-center justify-center rounded-full p-4 shadow-lg transition-colors">
              <Play className="ml-1 size-8" />
            </span>
          </button>
        )}

        {viewMode === "overlay" && (
          <div
            ref={dividerRef}
            role="slider"
            tabIndex={0}
            aria-label="Comparison position"
            aria-valuemin={MIN_PERCENT}
            aria-valuemax={MAX_PERCENT}
            aria-valuenow={Math.round(position)}
            aria-orientation="horizontal"
            className={cn(
              "absolute inset-y-0 z-10 flex w-10 -translate-x-1/2 cursor-ew-resize items-center justify-center outline-none",
              "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
              !suppressTransition && "transition-[left] duration-700 ease-in-out",
            )}
            style={{ left: `${String(position)}%` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          >
            {/* Hardcoded white/black, not theme tokens: this sits on top of
                arbitrary gameplay footage (bright and dark maps alike), not
                page chrome - a neutral handle with a dark contrast ring
                reads reliably regardless of which of the 6 site themes or
                which clip is playing underneath it. */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
            <div className="pointer-events-none relative flex size-9 items-center justify-center rounded-full bg-white text-neutral-700 shadow-lg ring-1 ring-black/20">
              <ChevronsLeftRight className="size-4" />
            </div>
          </div>
        )}

        {/* Sits above the pre-start play cover (z-[5]) so it's usable even
            before playback starts - it's a small button, not the whole
            cover, so the two don't otherwise compete for clicks. */}
        <button
          type="button"
          onClick={() => {
            setViewMode((mode) => (mode === "overlay" ? "sideBySide" : "overlay"));
          }}
          className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center rounded-full bg-black/60 p-1.5 text-white shadow-md transition-colors hover:bg-black/80"
          aria-label={
            viewMode === "overlay" ? "Show both videos side by side" : "Show overlay comparison"
          }
          aria-pressed={viewMode === "sideBySide"}
        >
          {viewMode === "overlay" ? (
            <Columns2 className="size-4" />
          ) : (
            <ChevronsLeftRight className="size-4" />
          )}
        </button>
      </div>

      {caption && (
        <figcaption className="text-muted-foreground px-4 py-4 text-center text-sm leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
