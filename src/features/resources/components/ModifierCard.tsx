import { Check, TriangleAlert } from "lucide-react";
import Image from "next/image";

import { assetPath } from "@/shared/lib/asset-cdn";
import { cn } from "@/shared/ui/lib/cn";

import { MODIFIER_ICON_SIZE, type SeasonalModifier } from "../data/seasonal-modifiers";
import { CLASH_SOURCE_LABELS, formatModifierPoints } from "../lib/modifier-plan";

/** A picked modifier this card can't be combined with. */
export interface ModifierCardClash {
  name: string;
  guess: boolean;
}

export interface ModifierCardProps {
  modifier: SeasonalModifier;
  picked?: boolean;
  /** False dims the card (it's outside the current highlight). */
  highlighted?: boolean;
  /** Picked modifiers this one clashes with. */
  clashes?: readonly ModifierCardClash[];
  /** Toggles the pick. Global modifiers have none: they always apply. */
  onToggle?: () => void;
}

const KIND_STYLES = {
  global: { tint: "from-muted", ring: "", badge: "" },
  positive: {
    tint: "from-status-green-soft",
    ring: "border-status-green ring-status-green/40 ring-1",
    badge: "bg-status-green",
  },
  negative: {
    tint: "from-status-red-soft",
    ring: "border-status-red ring-status-red/40 ring-1",
    badge: "bg-status-red",
  },
} as const;

/**
 * One modifier, laid out like the cards on BSG's announcement: icon on the
 * left, name and points in caps, then the effects as bullets, on a dark
 * card tinted green for positive and red for negative modifiers. Personal
 * modifiers are toggle buttons; global ones are plain cards since they
 * apply to everyone.
 */
export function ModifierCard({
  modifier,
  picked = false,
  highlighted = true,
  clashes = [],
  onToggle,
}: ModifierCardProps) {
  const style = KIND_STYLES[modifier.kind];
  const clashing = clashes.length > 0;
  const body = (
    <>
      <Image
        src={assetPath(modifier.icon)}
        alt=""
        width={MODIFIER_ICON_SIZE}
        height={MODIFIER_ICON_SIZE}
        className="mt-0.5 size-12 shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[0.95rem] leading-tight font-semibold tracking-wide uppercase">
          {modifier.name}
          {modifier.kind !== "global" && (
            <span className="ml-1.5 tabular-nums">{formatModifierPoints(modifier.points)}</span>
          )}
        </p>
        <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs leading-snug">
          {modifier.effects.map((effect) => (
            <li key={effect} className="flex gap-1.5">
              <span aria-hidden="true">•</span>
              <span>{effect}</span>
            </li>
          ))}
        </ul>
        {clashing && (
          <p className="text-status-amber mt-1.5 flex items-start gap-1 text-xs font-medium">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Clashes with{" "}
              {clashes.map((clash, index) => (
                <span key={clash.name}>
                  {index > 0 && ", "}
                  {clash.name}
                  {` (${CLASH_SOURCE_LABELS[clash.guess ? "guess" : "season1"].short})`}
                </span>
              ))}
            </span>
          </p>
        )}
      </div>
      {/* Pinned over the card's top-right corner, outside the flex flow, so
          picking a card never takes width from its text and rewraps it. */}
      {picked && (
        <span
          className={cn(
            "border-background text-background absolute -top-2 -right-2 z-10 flex size-6 items-center justify-center rounded-full border-2 shadow-sm",
            style.badge,
          )}
        >
          <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      )}
    </>
  );

  const className = cn(
    "border-border bg-card relative flex w-full items-start gap-3 rounded-md border bg-linear-to-r to-transparent to-60% px-3 py-2.5 text-left",
    "motion-safe:transition-[opacity,border-color,box-shadow] motion-safe:duration-200",
    style.tint,
    picked && style.ring,
    picked && clashing && "border-status-amber ring-status-amber/40",
    !highlighted && "opacity-30",
  );

  if (!onToggle) return <div className={className}>{body}</div>;

  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onToggle}
      className={cn(
        className,
        "focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
        !picked && "hover:border-(--border2)",
      )}
    >
      {body}
    </button>
  );
}
