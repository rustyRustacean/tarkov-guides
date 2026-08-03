"use client";

import { ChevronsLeftRight, Columns2 } from "lucide-react";
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

/** "Roughly on screen" bar for the divider-reset effect - see `VideoCompareSlider`'s matching constant. */
const VISIBILITY_RESET_THRESHOLD = 0.25;
/** Deliberately near-1, not exactly 1 - see `VideoCompareSlider`. */
const INTRO_VISIBILITY_THRESHOLD = 0.98;
const INTRO_DELAY_MS = 500;
/** Side-by-side mode's pop-out width cap - see `VideoCompareSlider`. */
const SIDE_BY_SIDE_MAX_WIDTH_PX = 2400;

interface Props {
  leftSrc: string;
  rightSrc: string;
  leftAlt: string;
  rightAlt: string;
  /** Small badge over the left image (e.g. "Right-Hand"). Omit for no label. */
  leftLabel?: string;
  /** Small badge over the right image (e.g. "Left-Hand"). Omit for no label. */
  rightLabel?: string;
  caption?: string;
  className?: string;
}

/**
 * `VideoCompareSlider`'s sibling for a pair of static stills instead of
 * synced video clips (e.g. the same peek angle shown right-hand vs.
 * left-hand). Shares its divider-drag/side-by-side-toggle/intro-reveal
 * mechanics and layout wholesale (see that component's doc comment for how
 * those work) but drops everything that only exists to sequence *playback*:
 * there's no click-to-play gate, no loading/ready state, and no
 * visibility-gated autoplay/loop-sync - a plain `<img>` just loads like any
 * other image, so both pictures are simply present from the first render.
 */
export function ImageCompareSlider({
  leftSrc,
  rightSrc,
  leftAlt,
  rightAlt,
  leftLabel,
  rightLabel,
  caption,
  className,
}: Props) {
  const resolvedLeftSrc = assetPath(leftSrc);
  const resolvedRightSrc = assetPath(rightSrc);

  const leftClipRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const hasUserInteractedRef = useRef(false);

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(50);
  const [viewMode, setViewMode] = useState<"overlay" | "sideBySide">("overlay");

  const prefersReducedMotion = usePrefersReducedMotion();
  const isVisible = useInViewport(containerEl, VISIBILITY_RESET_THRESHOLD);
  const isFullyVisible = useInViewport(containerEl, INTRO_VISIBILITY_THRESHOLD);

  const suppressTransition = isDragging || prefersReducedMotion;

  // See `VideoCompareSlider` for why this resets the divider to center once
  // the card scrolls (mostly) out of view, and why it's skipped once the
  // reader has taken the divider over themselves.
  useEffect(() => {
    if (isVisible || hasUserInteractedRef.current) return;
    setPosition(50);
  }, [isVisible]);

  // The reveal intro - see `VideoCompareSlider` for the full rationale
  // (independent of load state here too, since there's nothing to load).
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

  /** Imperative style write for the live-drag path - see `VideoCompareSlider`'s matching function. */
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
          <p className="text-muted-foreground text-sm">Image failed to load</p>
        </div>
      </div>
    );
  }

  return (
    <figure
      className={cn(
        "not-prose bg-card border-border overflow-hidden rounded-xl border shadow-sm",
        !suppressTransition && "transition-all duration-700 ease-in-out",
        className,
      )}
      // See `VideoCompareSlider` for why side-by-side mode pops out wider
      // than the surrounding prose column via a `vw`-based width.
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
        {/* Right panel wrapper - full-width in overlay mode, right half in side-by-side. */}
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
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed local guide still, not run through next/image, matching the plain-img convention `VideoCompareSlider`'s posters already use in this feature. */}
          <img
            src={resolvedRightSrc}
            alt={rightAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => {
              setHasError(true);
            }}
          />

          {rightLabel && (
            <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {rightLabel}
            </span>
          )}
        </div>

        {/* Left clip's clip boundary lives on this wrapper, not the <img> itself, so its label gets clipped along with it. */}
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
          {/* eslint-disable-next-line @next/next/no-img-element -- see the matching comment on the right image above. */}
          <img
            src={resolvedLeftSrc}
            alt={leftAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => {
              setHasError(true);
            }}
          />

          {leftLabel && (
            <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {leftLabel}
            </span>
          )}
        </div>

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
            {/* Hardcoded white/black, not theme tokens - see `VideoCompareSlider` for why. */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
            <div className="pointer-events-none relative flex size-9 items-center justify-center rounded-full bg-white text-neutral-700 shadow-lg ring-1 ring-black/20">
              <ChevronsLeftRight className="size-4" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setViewMode((mode) => (mode === "overlay" ? "sideBySide" : "overlay"));
          }}
          className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center rounded-full bg-black/60 p-1.5 text-white shadow-md transition-colors hover:bg-black/80"
          aria-label={
            viewMode === "overlay" ? "Show both images side by side" : "Show overlay comparison"
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
