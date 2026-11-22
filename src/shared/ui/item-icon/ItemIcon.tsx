import { cn } from "@/shared/ui/lib/cn";

const SIZE_CLASS = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const;

/** Props for {@link ItemIcon}. */
export interface ItemIconProps {
  /** The item's tarkov.dev icon URL; `null` or empty renders a muted placeholder of the same size. */
  src: string | null | undefined;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

/**
 * An item's tarkov.dev icon at a fixed square size. Decorative (`alt=""`):
 * every caller shows the item's name next to it, so a screen reader would
 * only hear the name twice. A missing icon keeps its box, so rows of items
 * stay aligned.
 */
export function ItemIcon({ src, size = "sm", className }: ItemIconProps) {
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={cn("bg-muted shrink-0 rounded", SIZE_CLASS[size], className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn("shrink-0 object-contain", SIZE_CLASS[size], className)}
    />
  );
}
