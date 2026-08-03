"use client";

import { useEffect, useRef, useState } from "react";

const CONTACT_MESSAGE = "Got any questions? Have an issue or idea with the site? Reach out here.";
const CONTACT_METHODS = [
  { label: "Email", value: "tarkovguides@protonmail.com" },
  { label: "Discord username", value: "JeffTheJolly" },
  { label: "Discord username", value: "xnikolai09x" },
] as const;

/**
 * Footer-only "Contact us" link. Clicking it toggles a themed speech-bubble
 * popup above the link - hand-rolled (no `@radix-ui/react-popover`
 * dependency, not currently in this project, and overkill for a few lines
 * of static text) with a click-outside listener to close it, the same
 * pattern `QuestTreeView`'s drag-to-pan uses for a window-level listener
 * tied to open/interaction state. Previously a site-wide fixed "Contact Us"
 * button (mounted in the root layout on every page); moved into the footer
 * as "About" per a design change, then renamed back to "Contact us" and
 * expanded with an email address alongside the existing Discord contacts.
 */
export function ContactLink() {
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
          <p>{CONTACT_MESSAGE}</p>
          <div className="mt-2 space-y-2">
            {CONTACT_METHODS.map((method) => (
              <p key={method.label}>
                <span className="text-muted-foreground block text-xs tracking-wide uppercase">
                  {method.label}
                </span>
                <span className="font-display text-primary text-base font-semibold tracking-wide">
                  {method.value}
                </span>
              </p>
            ))}
          </div>
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
        Contact us
      </button>
    </div>
  );
}
