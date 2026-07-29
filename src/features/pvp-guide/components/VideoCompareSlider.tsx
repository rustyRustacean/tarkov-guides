"use client";

import { ChevronsLeftRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

/** Same bar as `AutoplayVideo`'s: roughly on screen is enough to be worth decoding/playing both clips. */
const AUTOPLAY_VISIBILITY_THRESHOLD = 0.25;
/** Deliberately near-1, not exactly 1: the whole point is "the reader can actually see the whole comparison," not a technicality about one clipped pixel. */
const INTRO_VISIBILITY_THRESHOLD = 0.98;
const INTRO_DELAY_MS = 500;

interface Props {
  leftSrc: string;
  rightSrc: string;
  leftAlt: string;
  rightAlt: string;
  /** Small badge over the left video (e.g. "Peeker's POV"). Omit for no label. */
  leftLabel?: string;
  /** Small badge over the right video (e.g. "Enemy's POV"). Omit for no label. */
  rightLabel?: string;
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
 * Both clips are muted/looped/visibility-gated exactly like `AutoplayVideo`
 * (`useInViewport`) - but looped manually (`ended`, not the `loop`
 * attribute): whichever clip finishes first resets *both* to 0 and restarts
 * them together, so two clips of slightly different lengths can't drift out
 * of sync loop after loop the way two independently-`loop`ing videos would.
 *
 * The divider starts at 50/50 (so the page shows an unmistakable "split
 * view" the instant it's scrolled anywhere into view, even mid-scroll),
 * then - once the *whole* card is on screen - eases over to
 * `INTRO_REVEAL_PERCENT` once, ever (`hasIntroPlayedRef`). That teaches the
 * drag affordance without ever requiring an action just to see a full clip:
 * the reader lands on one full video by default and only has to drag if
 * they want the side-by-side split back.
 */
export function VideoCompareSlider({
  leftSrc,
  rightSrc,
  leftAlt,
  rightAlt,
  leftLabel,
  rightLabel,
  caption,
  className,
}: Props) {
  const leftVideoRef = useRef<HTMLVideoElement>(null);
  const rightVideoRef = useRef<HTMLVideoElement>(null);
  const leftClipRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const hasIntroPlayedRef = useRef(false);

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(50);

  const prefersReducedMotion = usePrefersReducedMotion();
  const isVisible = useInViewport(containerEl, AUTOPLAY_VISIBILITY_THRESHOLD);
  const isFullyVisible = useInViewport(containerEl, INTRO_VISIBILITY_THRESHOLD);

  const suppressTransition = isDragging || prefersReducedMotion;

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

    left.addEventListener("canplay", handleLeftCanPlay);
    right.addEventListener("canplay", handleRightCanPlay);
    left.addEventListener("error", handleError);
    right.addEventListener("error", handleError);

    if (left.readyState >= 3) handleLeftCanPlay();
    if (right.readyState >= 3) handleRightCanPlay();

    return () => {
      left.removeEventListener("canplay", handleLeftCanPlay);
      right.removeEventListener("canplay", handleRightCanPlay);
      left.removeEventListener("error", handleError);
      right.removeEventListener("error", handleError);
    };
  }, []);

  // Visibility-gated synced autoplay - only decode/play while on screen (see
  // `AutoplayVideo`), and keep both clips looping together (manual `ended`
  // handling instead of the native `loop` attribute, so whichever clip is
  // shorter can't drift ahead of the other loop after loop).
  useEffect(() => {
    const left = leftVideoRef.current;
    const right = rightVideoRef.current;
    if (!left || !right || isLoading || hasError) return;

    if (!isVisible) {
      left.pause();
      right.pause();
      return;
    }

    let cancelled = false;
    // Arrow function expressions, not `function` declarations - TypeScript
    // only preserves the `left`/`right` non-null narrowing from the guard
    // above into a closure created *after* it, not into a hoisted function
    // declaration's body.
    const attemptPlay = (video: HTMLVideoElement): void => {
      video.play().catch(() => {
        // Autoplay is commonly blocked immediately after a hard refresh -
        // a short retry frequently succeeds where the first attempt didn't.
        setTimeout(() => {
          if (!cancelled) void video.play().catch(() => undefined);
        }, 500);
      });
    };
    const restartBoth = (): void => {
      left.currentTime = 0;
      right.currentTime = 0;
      attemptPlay(left);
      attemptPlay(right);
    };

    left.addEventListener("ended", restartBoth);
    right.addEventListener("ended", restartBoth);
    attemptPlay(left);
    attemptPlay(right);

    return () => {
      cancelled = true;
      left.removeEventListener("ended", restartBoth);
      right.removeEventListener("ended", restartBoth);
    };
  }, [isVisible, isLoading, hasError]);

  // The reveal intro - once, the first time the whole card is on screen AND
  // actually showing something (gated on `!isLoading` too - otherwise, on a
  // slow connection the timer could fire and move `position` state while
  // the spinner's still up, so the divider/videos would mount already
  // sitting at the revealed position and the reader would never see the
  // initial 50/50 hint at all). Reduced motion still gets the *reveal*
  // (never requiring a drag just to see one full clip is the whole point -
  // see the component doc comment), just via a same-tick timeout instead of
  // a delayed one, so there's nothing to visually animate
  // (`suppressTransition` also turns off the CSS transition for these
  // users).
  useEffect(() => {
    if (!isFullyVisible || isLoading || hasIntroPlayedRef.current) return;
    hasIntroPlayedRef.current = true;

    const timer = setTimeout(
      () => {
        setPosition(INTRO_REVEAL_PERCENT);
      },
      prefersReducedMotion ? 0 : INTRO_DELAY_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [isFullyVisible, isLoading, prefersReducedMotion]);

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
        // See `AutoplayVideo` for why this opts out of `.prose` entirely
        // rather than fighting its default figure/video margins.
        "not-prose bg-card border-border w-full overflow-hidden rounded-xl border shadow-sm",
        className,
      )}
    >
      <div ref={setContainerEl} className="relative aspect-video w-full touch-none select-none">
        <video
          ref={rightVideoRef}
          aria-label={rightAlt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ display: isLoading ? "none" : "block" }}
          src={rightSrc}
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
        >
          Your browser does not support the video tag.
        </video>

        {!isLoading && rightLabel && (
          <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            {rightLabel}
          </span>
        )}

        {/* Left clip's clip boundary lives on this wrapper (not the <video>
            itself) so its label gets clipped along with it as one unit -
            dragging the divider to 20% should hide the left label too, not
            leave it floating over now-revealed right-video footage. */}
        <div
          ref={leftClipRef}
          className={cn(
            "absolute inset-0",
            !suppressTransition && "transition-[clip-path] duration-700 ease-in-out",
          )}
          style={{ clipPath: `inset(0 ${String(100 - position)}% 0 0)` }}
        >
          <video
            ref={leftVideoRef}
            aria-label={leftAlt}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ display: isLoading ? "none" : "block" }}
            src={leftSrc}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
          >
            Your browser does not support the video tag.
          </video>

          {!isLoading && leftLabel && (
            <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {leftLabel}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="bg-muted absolute inset-0 flex items-center justify-center">
            <div className="text-muted-foreground flex items-center gap-2">
              <div className="border-muted-foreground/40 border-t-muted-foreground h-6 w-6 animate-spin rounded-full border-2" />
              <span className="text-sm">Loading video...</span>
            </div>
          </div>
        )}

        {!isLoading && (
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
      </div>

      {caption && (
        <figcaption className="text-muted-foreground px-4 py-4 text-center text-sm leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
