"use client";

import { Film } from "lucide-react";

interface Props {
  /** Must match the target `AutoplayVideo`'s own `videoId` prop. */
  videoId?: string;
}

/**
 * A "jump to the video demo" CTA - ported from
 * `old/tarkov-tips/src/components/tutorials/SkipToVideo.tsx`, simplified.
 * The source polls the DOM after mount (with a 500ms re-check) to decide
 * whether a video exists on the page at all, because it was written to be
 * droppable into any tutorial regardless of content. This port doesn't need
 * that: only `content/pvp1.mdx` places this component, and only because its
 * author (this port) already knows that article has a real
 * `&lt;AutoplayVideo&gt;` further down - the existence check was solving a
 * problem this feature doesn't have.
 */
export function SkipToVideo({ videoId = "tutorial-video" }: Props) {
  function scrollToVideo(): void {
    const target = document.querySelector(`[data-video-id="${videoId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="from-primary/10 to-status-teal/10 border-primary/30 mb-6 rounded-xl border bg-gradient-to-r p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Film className="text-primary size-6 shrink-0" />
          <div>
            <h3 className="text-foreground font-semibold">Just want the key technique?</h3>
            <p className="text-muted-foreground text-sm">
              Skip straight to the video demonstration
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={scrollToVideo}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Jump to Video
        </button>
      </div>
    </div>
  );
}
