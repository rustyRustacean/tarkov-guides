"use client";

import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/ui/lib/cn";

import { useInViewport } from "../hooks/use-in-viewport";

/** Roughly on screen - enough to be worth decoding/playing, not a strict "fully visible" bar. */
const AUTOPLAY_VISIBILITY_THRESHOLD = 0.25;

interface Props {
  src: string;
  alt?: string;
  caption?: string;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  videoId?: string;
}

/**
 * A self-contained demo-clip player - ported from
 * `old/tarkov-tips/src/components/tutorials/AutoplayVideo.tsx`, restyled
 * with this project's theme tokens. The real interactivity is kept
 * faithfully (this is working browser-autoplay-policy handling, not a
 * novelty to drop): attempts autoplay once the clip can play AND is on
 * screen (`useInViewport` - a guide chapter can stack several of these, and
 * decoding/rendering a looping clip the reader has already scrolled past is
 * pure wasted CPU/battery for no visible benefit), retries once after a
 * short delay (autoplay is commonly blocked on a hard refresh but succeeds a
 * moment later), and falls back to starting playback on the user's first
 * click/keypress/touch anywhere on the page if the browser never allows a
 * fully unprompted autoplay. Pauses again the moment it scrolls off screen,
 * and won't resume on scroll-back-into-view if the user explicitly paused
 * it themselves (`userPausedRef`).
 */
export function AutoplayVideo({
  src,
  alt = "Tutorial demonstration video",
  caption,
  loop = true,
  muted = true,
  className,
  videoId = "tutorial-video",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  /** Set on an explicit pause-button click, so the visibility effect below doesn't fight the user's own choice by resuming playback the moment this clip scrolls back into view. Not `useState`: it never needs to trigger a render on its own, only to be read inside other effects/handlers. */
  const userPausedRef = useRef(false);

  const isVisible = useInViewport(wrapperEl, AUTOPLAY_VISIBILITY_THRESHOLD);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleLoadStart(): void {
      setIsLoading(true);
    }
    function handleCanPlay(): void {
      setIsLoading(false);
    }
    function handleError(): void {
      setIsLoading(false);
      setHasError(true);
    }
    function handlePlay(): void {
      setIsPlaying(true);
    }
    function handlePause(): void {
      setIsPlaying(false);
    }

    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    if (video.readyState >= 3) handleCanPlay();

    return () => {
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  // Only decode/play while the clip is actually on screen - these are
  // looping background-style demo clips, so leaving them running off-screen
  // is pure wasted CPU/battery/bandwidth for no visible benefit.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLoading || hasError) return;

    if (!isVisible) {
      video.pause();
      return;
    }
    if (userPausedRef.current) return;

    let cancelled = false;
    video.play().catch(() => {
      // Autoplay is commonly blocked immediately after a hard refresh - a
      // short retry frequently succeeds where the first attempt didn't.
      setTimeout(() => {
        if (!cancelled && !userPausedRef.current) void video.play().catch(() => undefined);
      }, 500);
    });
    return () => {
      cancelled = true;
    };
  }, [isVisible, isLoading, hasError]);

  useEffect(() => {
    if (isPlaying || hasError || isLoading || !isVisible) return;

    function handleUserInteraction(): void {
      const video = videoRef.current;
      if (!video || userPausedRef.current) return;
      void video.play();
    }

    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("keydown", handleUserInteraction, { once: true });
    document.addEventListener("touchstart", handleUserInteraction, { once: true });
    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
    };
  }, [isPlaying, hasError, isLoading, isVisible]);

  function togglePlay(): void {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      userPausedRef.current = true;
      video.pause();
    } else {
      userPausedRef.current = false;
      void video.play();
    }
  }

  function restart(): void {
    const video = videoRef.current;
    if (!video) return;
    userPausedRef.current = false;
    video.currentTime = 0;
    void video.play();
  }

  function toggleFullscreen(): void {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void video.requestFullscreen();
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
          <p className="text-muted-foreground mt-1 text-xs">{alt}</p>
        </div>
      </div>
    );
  }

  return (
    <figure
      className={cn(
        // `not-prose`: this card fully owns its own spacing/borders/background,
        // so it opts out of `.prose`'s default figure/video/figcaption margins
        // entirely rather than trying to out-specificity them (`.prose video`
        // and a plain utility class land at equal specificity - `:where()`
        // only zeroes the tag it wraps, not the leading `.prose` class - so
        // which one wins is just a coin flip on generated CSS order).
        "not-prose bg-card border-border w-full overflow-hidden rounded-xl border shadow-sm",
        className,
      )}
      data-video-id={videoId}
    >
      <div
        ref={setWrapperEl}
        className="group relative"
        onMouseEnter={() => {
          setShowControls(true);
        }}
        onMouseLeave={() => {
          setShowControls(false);
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- these are silent, dialogue-free gameplay demo clips (always `muted`); there's no audio/speech content a caption track could transcribe. */}
        <video
          ref={videoRef}
          className="h-auto w-full max-w-full"
          style={{ display: isLoading ? "none" : "block", aspectRatio: "16/9" }}
          src={src}
          loop={loop}
          muted={muted}
          playsInline
          preload="metadata"
          aria-label={alt}
          disablePictureInPicture
          disableRemotePlayback
        >
          Your browser does not support the video tag.
        </video>

        {isLoading && (
          <div className="bg-muted flex aspect-video items-center justify-center">
            <div className="text-muted-foreground flex items-center gap-2">
              <div className="border-muted-foreground/40 border-t-muted-foreground h-6 w-6 animate-spin rounded-full border-2" />
              <span className="text-sm">Loading video...</span>
            </div>
          </div>
        )}

        {!isLoading && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300",
              showControls || !isPlaying ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="bg-background/90 hover:bg-background text-foreground rounded-full p-3 shadow-lg transition-colors"
                aria-label={isPlaying ? "Pause video" : "Play video"}
              >
                {isPlaying ? <Pause className="size-6" /> : <Play className="ml-1 size-6" />}
              </button>
              <button
                type="button"
                onClick={restart}
                className="bg-background/80 hover:bg-background text-foreground rounded-full p-2 shadow-md transition-colors"
                aria-label="Restart video"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="bg-background/80 hover:bg-background text-foreground rounded-full p-2 shadow-md transition-colors"
                aria-label="Toggle fullscreen"
              >
                <Maximize2 className="size-4" />
              </button>
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
