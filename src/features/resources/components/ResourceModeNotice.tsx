"use client";

import { Info } from "lucide-react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { PROFILE_MODE_LABELS, type ProfileMode } from "@/features/progress-tracker/types";

/**
 * Tells the reader when the site's game mode (the header switch) isn't one
 * this resource covers. It explains rather than adding a mode toggle of its
 * own: the header switch is the site's only mode control
 * (`architecture.mdx`, "One site-wide game mode").
 */
export function ResourceModeNotice({ modes }: { modes: readonly ProfileMode[] }) {
  const activeMode = useProgressTrackerStore((state) => state.activeMode);
  if (modes.includes(activeMode)) return null;

  const covered = modes.map((mode) => PROFILE_MODE_LABELS[mode]).join(" and ");
  return (
    <p
      role="note"
      className="border-border bg-card text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <Info className="text-status-amber mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        This covers {covered}. The site is set to {PROFILE_MODE_LABELS[activeMode]}; switch modes in
        the header if you play {covered}.
      </span>
    </p>
  );
}
