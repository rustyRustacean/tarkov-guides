"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  /** The image URL to show full-size, or null when closed. */
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/**
 * Full-screen image viewer - a body-level portal above every dialog
 * (`z-[100]`). Click anywhere or press Escape to dismiss. Ported from
 * `old/TarkovTrackerWB-main/src/lib/wiki.js`'s `showMarkerLightbox`.
 */
export function Lightbox({ src, alt = "", onClose }: Props) {
  useEffect(() => {
    if (src === null) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [src, onClose]);

  if (src === null || typeof document === "undefined") return null;

  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- backdrop dismiss; Escape is handled by the document listener above.
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external wiki-hosted screenshot, not a local/optimizable asset. */}
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full rounded object-contain shadow-2xl"
      />
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="bg-background/90 text-foreground absolute top-4 right-4 rounded-full p-2 shadow-sm"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
