"use client";

import { useEffect, useRef, useState } from "react";

const ABOUT_MESSAGE =
  "Got any questions? Have an issue or idea with the site? Feel free to contact me on Discord — username's JeffTheJolly.";

/**
 * Footer-only "About" link. Clicking it toggles a themed speech-bubble popup
 * above the link - hand-rolled (no `@radix-ui/react-popover` dependency, not
 * currently in this project, and overkill for one static line of text) with
 * a click-outside listener to close it, the same pattern `QuestTreeView`'s
 * drag-to-pan uses for a window-level listener tied to open/interaction
 * state. Previously a site-wide fixed "Contact Us" button (mounted in the
 * root layout on every page); moved into the footer and renamed per a
 * design change so it's no longer always on-screen.
 */
export function AboutLink() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {open && (
        <div className="border-border bg-card text-card-foreground absolute right-0 bottom-full mb-3 w-64 rounded-lg border p-3 text-left text-sm shadow-lg">
          {ABOUT_MESSAGE}
          <span
            aria-hidden="true"
            className="border-border bg-card absolute right-5 -bottom-1.5 h-3 w-3 rotate-45 border-r border-b"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
      >
        About
      </button>
    </div>
  );
}
