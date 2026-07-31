"use client";

import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useCallback, useEffect } from "react";

import { getFullResolutionImageUrl } from "@/shared/data/quest-guide-images";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog/Dialog";
import { cn } from "@/shared/ui/lib/cn";

import type { QuestGuideImage } from "@/shared/data/quest-guide-images";

export interface QuestGuideImageLightboxProps {
  images: readonly QuestGuideImage[];
  /** `null` closes the lightbox; otherwise the currently-shown index into `images`. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/**
 * Full-resolution image viewer for a task's curated `QUEST_GUIDE_IMAGES`
 * screenshots, opened from `ObjectiveGuideImages`'s thumbnail grid - mirrors
 * the EFT wiki's own MediaWiki image-gallery lightbox (large image, a
 * "Full size" link to the true original, prev/next through every image for
 * the task, and a filmstrip of thumbnails to jump directly to one) rather
 * than the previous behavior of just opening one scaled thumbnail URL in a
 * new tab. `getFullResolutionImageUrl` recovers the true original from the
 * scaled `src` the thumbnail grid itself uses - see its own doc comment for
 * why that transform is safe.
 *
 * Built on the shared `Dialog` primitive (nested inside `QuestDetailDialog`,
 * which is itself a `Dialog`) rather than a bespoke overlay - Radix's focus
 * trap/scroll-lock/Escape-to-close all come free, and two Radix dialogs
 * portal-mount in open order so this one (opened later, from inside the
 * first) naturally paints on top without any manual z-index bookkeeping.
 * Left/Right arrow-key cycling is the one extra behavior added on top,
 * scoped to only listen while this dialog is actually open.
 */
export function QuestGuideImageLightbox({
  images,
  index,
  onIndexChange,
}: QuestGuideImageLightboxProps) {
  const open = index !== null;
  const current = index !== null ? images[index] : undefined;

  const goTo = useCallback(
    (delta: number) => {
      if (index === null || images.length === 0) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "ArrowLeft") goTo(-1);
      else if (event.key === "ArrowRight") goTo(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, goTo]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onIndexChange(null);
      }}
    >
      <DialogContent className="w-[92vw] max-w-4xl gap-0 overflow-hidden p-0">
        {current && index !== null && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b px-4 py-3 pr-10">
              <DialogTitle className="truncate text-base">{current.caption}</DialogTitle>
              <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
                {images.length > 1 && (
                  <span>
                    {index + 1} / {images.length}
                  </span>
                )}
                <a
                  href={getFullResolutionImageUrl(current.src)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Full size
                </a>
              </div>
            </div>

            <div className="bg-background relative flex items-center justify-center">
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    goTo(-1);
                  }}
                  aria-label="Previous image"
                  className="bg-card/80 hover:bg-card text-foreground absolute left-2 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- external wiki-hosted screenshot, not a local/optimizable asset. */}
              <img
                key={current.src}
                src={getFullResolutionImageUrl(current.src)}
                alt={current.caption}
                // Same Fandom anti-hotlink constraint `ObjectiveGuideImages`'s
                // own thumbnails already document - a bare `<img>` here 404s.
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-full object-contain"
              />
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    goTo(1);
                  }}
                  aria-label="Next image"
                  className="bg-card/80 hover:bg-card text-foreground absolute right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-colors"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t p-3">
                {images.map((image, imageIndex) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => {
                      onIndexChange(imageIndex);
                    }}
                    aria-label={`Show image ${String(imageIndex + 1)}: ${image.caption}`}
                    aria-current={imageIndex === index}
                    className={cn(
                      "shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                      imageIndex === index ? "border-primary" : "border-transparent",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- external wiki-hosted screenshot, not a local/optimizable asset. */}
                    <img
                      src={image.src}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-12 w-16 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
