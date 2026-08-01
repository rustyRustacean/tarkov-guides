"use client";

import { Construction } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A small flag explaining that this guide's demo videos are an early,
 * temporary work in progress (real per-topic footage is still being
 * produced chapter by chapter - see `HANDOFF.md`'s video-production
 * entries) rather than a finished feature, so a reader who hits a rough
 * edge (a clip that still shares content with another topic, an odd crop,
 * etc.) has somewhere to report it instead of assuming it's just broken.
 *
 * Styled with the `status-amber` warning tokens (not the neutral
 * `bg-card`/`text-muted-foreground` a plain informational badge would use)
 * plus a small `animate-ping` corner dot - deliberately more attention-
 * grabbing than a quiet footnote, since "this is actively being worked on
 * and may change" is worth a reader actually noticing, not just having
 * technically been told once.
 *
 * Click-toggled rather than hover-only so it's equally reachable via touch
 * and keyboard (the same accessibility reasoning the PvP Guide's earlier
 * "more sections coming" notice used before it was removed - see
 * `KNOWN_ISSUES.md` L-1 for the underlying hover-only gap that motivated
 * click-first).
 */
export function VideoDisclaimerNotice() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="fixed top-1/2 right-3 z-30 -translate-y-1/2 sm:right-6">
      {open && (
        <div
          role="status"
          className="border-status-amber/40 bg-popover text-popover-foreground absolute top-1/2 right-full mr-2 w-56 -translate-y-1/2 rounded-md border p-3 text-xs shadow-md"
        >
          <p className="text-status-amber flex items-center gap-1.5 font-semibold">
            <Construction className="size-3.5 shrink-0" aria-hidden="true" />
            Work in progress
          </p>
          <p className="text-muted-foreground mt-1.5">
            This guide&apos;s videos are temporary placeholders while proper footage gets recorded
            for every topic (so expect things to look rough or change without notice).
          </p>
          <p className="text-muted-foreground mt-1.5">
            Running into an issue? Reach out via the About link in the footer.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-label="This guide's videos are a work in progress"
        className="border-status-amber/50 bg-status-amber-soft text-status-amber hover:bg-status-amber/20 relative flex size-10 items-center justify-center rounded-full border shadow-md transition-colors"
      >
        <Construction className="size-4" aria-hidden="true" />
        {/* Classic "notification dot" pair - a static dot with a duplicate
            `animate-ping` copy underneath for the pulsing ring, standard
            Tailwind recipe for "something here wants your attention"
            without being a full animated banner. */}
        <span className="absolute -top-1 -right-1 flex size-3">
          <span className="bg-status-amber absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-status-amber relative inline-flex size-3 rounded-full" />
        </span>
      </button>
    </div>
  );
}
