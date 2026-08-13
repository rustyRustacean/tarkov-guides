"use client";

import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { assetPath } from "@/shared/lib/asset-cdn";
import { cn } from "@/shared/ui/lib/cn";

import { useInViewport } from "../hooks/use-in-viewport";

/** Roughly on screen: enough to be worth decoding/playing, not a strict "fully visible" bar. */
const AUTOPLAY_VISIBILITY_THRESHOLD = 0.25;

interface Props {
  src: string;
  alt?: string;
  caption?: string;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  videoId?: string;
  // `| undefined` (not just `?`) since `CondensedGuideSection` passes
  // `section.videoPoster` through explicitly rather than omitting the key,
  // which `exactOptionalPropertyTypes` requires.
  /** Optional static still shown behind the click-to-play cover. Falls back to a plain icon-on-muted-background placeholder when omitted. */
  poster?: string | undefined;
}

/**
 * A self-contained, click-to-play demo-clip player, ported from
 * `old/tarkov-tips/src/components/tutorials/AutoplayVideo.tsx` (which
 * autoplayed on scroll-into-view). Reworked here since nothing downloads or
 * plays until the reader explicitly clicks: a guide page can stack several
 * of these, and fetching every one just because it scrolled past was real,
 * uncounted bandwidth cost for readers who never watched. `preload="none"`
 * means nothing is fetched pre-click; the aspect ratio is hardcoded
 * (`aspectRatio: "16/9"`) so no natural dimensions are needed up front. Once
 * started, it still pauses when scrolled off screen and resumes on
 * scroll-back (`useInViewport`) unless the reader explicitly paused it
 * themselves (`userPausedRef`). That part costs no additional bandwidth (the
 * clip is already buffering/buffered); it's purely a CPU/battery courtesy
 * for a looping background-style clip.
 */
export function VideoClip({
  src,
  alt = "Tutorial demonstration video",
  caption,
  loop = true,
  muted = true,
  className,
  videoId = "tutorial-video",
  poster,
}: Props) {
  const resolvedSrc = assetPath(src);
  const resolvedPoster = poster ? assetPath(poster) : undefined;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  // Only decode/play while the clip is actually on screen: these are
  // looping background-style demo clips, so leaving them running off-screen
  // is pure wasted CPU/battery for no visible benefit. Gated on `hasStarted`
  // so this can never itself be the thing that triggers the first, real
  // (bandwidth-costing) load; only `handleStart`'s direct click does that.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasStarted || isLoading || hasError) return;

    if (!isVisible) {
      video.pause();
      return;
    }
    if (userPausedRef.current) return;

    void video.play().catch(() => undefined);
  }, [hasStarted, isVisible, isLoading, hasError]);

  /** The only place that ever triggers the first `.play()`, always a direct click, so browser autoplay policy never blocks it (a rejection here is a genuine playback error, not a policy block worth retrying). */
  function handleStart(): void {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    video.play().catch(() => undefined);
  }

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
        // See `VideoCompareSlider` for why this opts out of `.prose` entirely
        // rather than fighting its default figure/video margins.
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
          style={{ display: !hasStarted || isLoading ? "none" : "block", aspectRatio: "16/9" }}
          src={resolvedSrc}
          loop={loop}
          muted={muted}
          playsInline
          preload="none"
          poster={resolvedPoster}
          aria-label={alt}
          disablePictureInPicture
          disableRemotePlayback
        >
          Your browser does not support the video tag.
        </video>

        {!hasStarted && (
          <button
            type="button"
            onClick={handleStart}
            className="bg-muted flex aspect-video w-full items-center justify-center bg-cover bg-center"
            style={resolvedPoster ? { backgroundImage: `url(${resolvedPoster})` } : undefined}
            aria-label={`Play video: ${alt}`}
          >
            <span className="bg-background/90 group-hover:bg-background flex items-center justify-center rounded-full p-4 shadow-lg transition-colors">
              <Play className="ml-1 size-8" />
            </span>
          </button>
        )}

        {hasStarted && isLoading && (
          <div className="bg-muted flex aspect-video items-center justify-center">
            <div className="text-muted-foreground flex items-center gap-2">
              <div className="border-muted-foreground/40 border-t-muted-foreground h-6 w-6 animate-spin rounded-full border-2" />
              <span className="text-sm">Loading video...</span>
            </div>
          </div>
        )}

        {hasStarted && !isLoading && (
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
