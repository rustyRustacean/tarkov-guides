import { ArrowUpRight, MousePointer2 } from "lucide-react";
import Image from "next/image";

import { assetPath } from "@/shared/lib/asset-cdn";
import { Badge } from "@/shared/ui/badge/Badge";
import { cn } from "@/shared/ui/lib/cn";

import type { CommunityPreview } from "../data/community-previews";
import type { CommunityResource } from "../data/resources";
import type { CSSProperties } from "react";

/** How long the hover pan takes for a capture of `height` px, so a longer page scrolls a little longer. */
export function panDurationMs(height: number): number {
  const screensBelowFold = Math.max(0, height - 800) / 800;
  return Math.round(Math.min(6000, Math.max(2500, screensBelowFold * 2000)));
}

export interface CommunityPreviewCardProps {
  resource: CommunityResource;
  preview: CommunityPreview;
  /** The group's wide first card: its image grows to fill the card's height on large screens. */
  lead?: boolean;
  /** Grid placement classes from the group layout. */
  className?: string;
}

/**
 * A community site as a card topped by a screenshot of it. When the page
 * was long enough to capture more than one screen (`preview.scroll`),
 * hovering or keyboard-focusing the card slowly pans the screenshot from
 * top to bottom, so you see the whole page before leaving for it. The pan
 * runs on `object-position`, needs no script, and only happens on devices
 * that can hover and for visitors who haven't asked for reduced motion;
 * everyone else sees the top of the page.
 */
export function CommunityPreviewCard({
  resource,
  preview,
  lead = false,
  className,
}: CommunityPreviewCardProps) {
  const panStyle = preview.scroll
    ? ({ "--pan-duration": `${String(panDurationMs(preview.height))}ms` } as CSSProperties)
    : undefined;

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group border-border bg-card text-card-foreground focus-visible:ring-ring flex flex-col overflow-hidden rounded-lg border shadow-sm focus-visible:ring-2 focus-visible:outline-none",
        "hover:border-(--border2) motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg",
        className,
      )}
    >
      <div
        className={cn(
          "border-border bg-muted relative w-full overflow-hidden border-b",
          lead ? "aspect-[16/10] lg:aspect-auto lg:min-h-64 lg:flex-1" : "aspect-[16/10]",
        )}
      >
        <Image
          src={assetPath(preview.src)}
          alt=""
          fill
          sizes={
            lead
              ? "(min-width: 1024px) 760px, 100vw"
              : "(min-width: 1024px) 370px, (min-width: 640px) 50vw, 100vw"
          }
          style={panStyle}
          className={cn(
            "object-cover object-top",
            preview.scroll &&
              "motion-safe:transition-[object-position] motion-safe:duration-700 motion-safe:ease-in-out motion-safe:group-hover:object-bottom motion-safe:group-hover:duration-(--pan-duration) motion-safe:group-focus-visible:object-bottom motion-safe:group-focus-visible:duration-(--pan-duration)",
          )}
        />
        {preview.scroll && (
          <span
            aria-hidden="true"
            className="bg-background/80 text-muted-foreground absolute bottom-2 left-2 hidden items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm transition-opacity group-hover:opacity-0 motion-safe:pointer-fine:inline-flex"
          >
            <MousePointer2 className="size-3" />
            Hover to scroll
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-lg leading-tight font-semibold">{resource.title}</span>
          <Badge variant="outline" className="text-[11px]">
            {resource.category}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{resource.description}</p>
        <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="truncate">{resource.hostname}</span>
          <ArrowUpRight
            aria-hidden="true"
            className="group-hover:text-primary size-4 shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
          />
        </div>
      </div>
      <span className="sr-only">(opens {resource.hostname} in a new tab)</span>
    </a>
  );
}
