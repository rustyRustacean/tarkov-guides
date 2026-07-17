"use client";

import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/ui/lib/cn";

interface Props {
  src: string;
  alt?: string;
  caption?: string;
  loop?: boolean;
  muted?: boolean;
  className?: string;
  /** Matched by `SkipToVideo`'s scroll target - see that component's doc comment. */
  videoId?: string;
}

/**
 * A self-contained demo-clip player - ported from
 * `old/tarkov-tips/src/components/tutorials/AutoplayVideo.tsx`, restyled
 * with this project's theme tokens. The real interactivity is kept
 * faithfully (this is working browser-autoplay-policy handling, not a
 * novelty to drop): attempts autoplay once the clip can play, retries once
 * after a short delay (autoplay is commonly blocked on a hard refresh but
 * succeeds a moment later), and falls back to starting playback on the
 * user's first click/keypress/touch anywhere on the page if the browser
 * never allows a fully unprompted autoplay.
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let autoplayAttempted = false;

    function attemptAutoplay(): void {
      if (!video) return;
      video.play().then(
        () => {
          setIsPlaying(true);
        },
        () => {
          setIsPlaying(false);
          // Autoplay is commonly blocked immediately after a hard refresh -
          // a short retry frequently succeeds where the first attempt didn't.
          setTimeout(() => {
            video.play().then(
              () => {
                setIsPlaying(true);
              },
              () => {
                setIsPlaying(false);
              },
            );
          }, 500);
        },
      );
    }

    function handleCanPlay(): void {
      setIsLoading(false);
      if (!autoplayAttempted) {
        autoplayAttempted = true;
        attemptAutoplay();
      }
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

    video.addEventListener("loadstart", () => {
      setIsLoading(true);
    });
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    if (video.readyState >= 3) handleCanPlay();

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  useEffect(() => {
    if (isPlaying || hasError || isLoading) return;

    function handleUserInteraction(): void {
      const video = videoRef.current;
      if (!video) return;
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
  }, [isPlaying, hasError, isLoading]);

  function togglePlay(): void {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.pause();
    else void video.play();
  }

  function restart(): void {
    const video = videoRef.current;
    if (!video) return;
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
        "bg-card border-border w-full overflow-hidden rounded-xl border shadow-sm",
        className,
      )}
      data-video-id={videoId}
    >
      <div
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
        <figcaption className="text-muted-foreground px-4 pt-3 pb-4 text-center text-sm leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
