"use client";

import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog/Dialog";
import { cn } from "@/shared/ui/lib/cn";

import type { WikiImage } from "@/shared/lib/wiki/fetch-wiki";

export interface LightboxProps {
  images: readonly WikiImage[];
  /** `null` closes the lightbox; otherwise the currently-shown index into `images`. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

interface ShownImage {
  src: string;
  caption: string;
  section: string | undefined;
}

/**
 * Full-resolution image viewer for a task's live-fetched wiki Guide
 * screenshots (`useWikiGuideData`), mirroring the EFT wiki's own MediaWiki
 * image-gallery lightbox: large image, prev/next through every image for
 * the task, and a filmstrip of thumbnails to jump directly to one.
 * `WikiImage.src` is already full resolution (`fetchWikiGuideData` strips
 * Fandom's scale-down URL segment before returning it), so unlike the
 * project's earlier hand-curated `quest-guide-images.ts` approach, there's
 * no separate thumbnail `src` or `getFullResolutionImageUrl` transform to
 * preserve.
 *
 * Built on the shared `Dialog` primitive (nested inside `QuestDetailDialog`,
 * itself a `Dialog`) rather than a bespoke portal. Radix's focus trap,
 * scroll lock, and Escape-to-close come free, and two Radix dialogs
 * portal-mount in open order, so this one (opened later, from inside the
 * first) naturally paints on top without manual z-index bookkeeping; see
 * docs-site/content/docs/architecture.mdx for the general reasoning.
 */
export function Lightbox({ images, index, onIndexChange }: LightboxProps) {
  const open = index !== null;
  const current = index !== null ? images[index] : undefined;
  // Primitives, not an inline object: an object literal would be a fresh
  // reference every render, defeating the effect's dependency check below
  // and re-triggering the crossfade on every unrelated re-render.
  const currentSrc = current?.src;
  const currentCaption = current?.caption;
  const currentSection = current?.section;

  const prefersReducedMotion = usePrefersReducedMotion();

  // `shown` is what's actually painted at full opacity; `incoming` is the
  // next image crossfading in on top of it. Kept as two separate layers
  // (rather than swapping `shown`'s own `src` directly) so the outgoing
  // image stays visible underneath instead of popping to a blank/loading
  // state while the new one loads. `incoming`'s own `onLoad` starts the
  // fade, so a slow network never shows a half-faded blank.
  const [shown, setShown] = useState<ShownImage | undefined>(
    currentSrc && currentCaption
      ? { src: currentSrc, caption: currentCaption, section: currentSection }
      : undefined,
  );
  const [incoming, setIncoming] = useState<ShownImage | null>(null);
  const [incomingVisible, setIncomingVisible] = useState(false);
  const previousImagesRef = useRef(images);
  // Mirrors `incoming?.src`, but as a ref so the effect below can check
  // "am I already crossfading to this target" without depending on
  // `incoming` state directly. `incoming` changes on every crossfade
  // start/cancel, so depending on it would re-run this effect off its own
  // writes indefinitely instead of only when the *target* actually changes.
  const incomingSrcRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentSrc === undefined || currentCaption === undefined) return;
    // A genuinely different task's image set (not just a new index within
    // the same one) swaps instantly: there's no "previous image" for it to
    // meaningfully crossfade from.
    const isNewTaskImageSet = previousImagesRef.current !== images;
    previousImagesRef.current = images;

    if (isNewTaskImageSet || !shown || prefersReducedMotion) {
      setShown({ src: currentSrc, caption: currentCaption, section: currentSection });
      setIncoming(null);
      incomingSrcRef.current = null;
      setIncomingVisible(false);
      return;
    }

    if (currentSrc === shown.src) {
      // Navigated back to what's already fully shown (e.g. Next then
      // Previous before the first crossfade finished). Cancel any stale
      // in-flight fade rather than let it keep animating over the correct
      // image.
      if (incomingSrcRef.current !== null) {
        setIncoming(null);
        incomingSrcRef.current = null;
        setIncomingVisible(false);
      }
      return;
    }

    if (incomingSrcRef.current === currentSrc) return; // already crossfading to this target

    setIncoming({ src: currentSrc, caption: currentCaption, section: currentSection });
    incomingSrcRef.current = currentSrc;
    setIncomingVisible(false);
  }, [currentSrc, currentCaption, currentSection, images, shown, prefersReducedMotion]);

  const handleIncomingLoad = useCallback(() => {
    // One frame between mounting at opacity-0 and flipping to opacity-100:
    // otherwise the class change lands in the same paint as the initial one
    // and the browser never has a "from" state to transition out of.
    requestAnimationFrame(() => {
      setIncomingVisible(true);
    });
  }, []);

  const handleIncomingTransitionEnd = useCallback(() => {
    if (!incoming) return;
    setShown(incoming);
    setIncoming(null);
    incomingSrcRef.current = null;
    setIncomingVisible(false);
  }, [incoming]);

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
              <DialogTitle className="truncate text-base">
                {[current.section, current.caption].filter(Boolean).join(" · ") || "Screenshot"}
              </DialogTitle>
              <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-xs">
                {images.length > 1 && (
                  <span>
                    {index + 1} / {images.length}
                  </span>
                )}
                <a
                  href={current.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Open
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
              {shown && (
                // eslint-disable-next-line @next/next/no-img-element -- external wiki-hosted screenshot, not a local/optimizable asset.
                <img
                  src={shown.src}
                  alt={shown.caption}
                  // Fandom's image CDN 404s any request carrying a
                  // `Referer` header from a non-Fandom origin (real
                  // anti-hotlink protection). Without this, every lightbox
                  // image 404'd despite loading fine as a thumbnail
                  // elsewhere on the page.
                  referrerPolicy="no-referrer"
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
              {incoming && (
                // eslint-disable-next-line @next/next/no-img-element -- external wiki-hosted screenshot, not a local/optimizable asset.
                <img
                  key={incoming.src}
                  src={incoming.src}
                  alt={incoming.caption}
                  referrerPolicy="no-referrer"
                  onLoad={handleIncomingLoad}
                  onError={handleIncomingLoad}
                  onTransitionEnd={handleIncomingTransitionEnd}
                  className={cn(
                    "absolute inset-0 m-auto max-h-[70vh] w-full object-contain transition-opacity duration-200 ease-in-out",
                    incomingVisible ? "opacity-100" : "opacity-0",
                  )}
                />
              )}
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
                    aria-label={`Show image ${String(imageIndex + 1)}${image.caption ? `: ${image.caption}` : ""}`}
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
