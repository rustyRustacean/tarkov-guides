"use client";

import { Construction } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A minimal "more sections are coming" flag pinned to the side of the PvP
 * Guide - the learning path already lists Full Guide entries as
 * "coming soon" (see `PvpGuidePage.tsx`), but that's easy to miss inside
 * the Full Guide tab. This surfaces it regardless of which tab is active,
 * without implying anything currently on the page is incomplete.
 *
 * Click-toggled rather than hover-only so it's equally reachable via touch
 * and keyboard, not just mouse hover (a real gap the Quest Card pin-toggle
 * audit already flagged elsewhere in this codebase - see `KNOWN_ISSUES.md`
 * L-1 - so this is deliberately built click-first from the start).
 */
export function MoreSectionsNotice() {
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
          className="border-border bg-popover text-popover-foreground absolute top-1/2 right-full mr-2 w-52 -translate-y-1/2 rounded-md border p-3 text-xs shadow-md"
        >
          <p className="text-foreground font-medium">More sections coming soon</p>
          <p className="text-muted-foreground mt-1">
            Rotating, staying unpredictable, and more key PvP tips are on the way.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-label="More PvP Guide sections coming soon"
        className="border-border bg-card text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-full border shadow-md transition-colors"
      >
        <Construction className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
