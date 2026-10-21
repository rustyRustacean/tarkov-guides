import { Backpack } from "lucide-react";

import { cn } from "@/shared/ui/lib/cn";

import type { BossPill, BossPillTone } from "../lib/boss-groups";
import type { ReactNode } from "react";

/** Border color per threat tone. Rings the portrait. */
const TONE_BORDER: Readonly<Record<BossPillTone, string>> = {
  hot: "border-status-red",
  warm: "border-status-amber",
  cool: "border-status-teal",
  mute: "border-border",
};

/** Chance-figure text color per threat tone. */
export const TONE_TEXT: Readonly<Record<BossPillTone, string>> = {
  hot: "text-status-red",
  warm: "text-status-amber",
  cool: "text-status-teal",
  mute: "text-muted-foreground",
};

/** A pill's spawn chance as a whole percentage (e.g. "35%"). */
export function spawnChanceText(pill: BossPill): string {
  return `${String(Math.round(pill.chance * 100))}%`;
}

/** Up-to-two-letter fallback badge when a boss has no portrait asset. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters =
    words.length >= 2 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : name.slice(0, 2);
  return letters.toUpperCase();
}

function titleFor(pill: BossPill): string {
  const condition = pill.badge ? ` · ${pill.badge.title}` : "";
  return `${pill.name} · ${spawnChanceText(pill)} spawn chance${condition} · click for gear & loot`;
}

interface PortraitProps {
  pill: BossPill;
  /** Sizing and any extra effects; the tone border and initials fallback are always applied. */
  className?: string;
  children?: ReactNode;
}

/**
 * A boss's face in its tone-colored frame, or initials when there's no
 * portrait asset. Shared by the strip and the gear and loot card's header.
 * `children` render inside the frame (corner glyphs, the sheen).
 */
export function BossPortrait({ pill, className, children }: PortraitProps) {
  return (
    <div
      className={cn(
        "bg-muted relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2",
        TONE_BORDER[pill.tone],
        className,
      )}
    >
      {pill.imagePortraitLink ? (
        // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted portrait, not a local/optimizable asset.
        <img
          src={pill.imagePortraitLink}
          alt=""
          className="h-full w-full object-cover transition-transform duration-200 motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110"
          onError={(event) => {
            // Missing/blocked asset: drop the img so the initials fallback shows.
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="text-muted-foreground text-[11px] font-semibold">
          {initials(pill.name)}
        </span>
      )}
      {children}
    </div>
  );
}

interface Props {
  pills: readonly BossPill[];
  /** Called with the clicked pill and its button, so the caller can open the gear and loot card and later hand focus back to that same button. */
  onSelect: (pill: BossPill, trigger: HTMLButtonElement) => void;
  /** Changing this replays the one-shot sheen across the portraits (pass the current map, so it plays once per map shown). */
  sheenKey?: string;
}

/**
 * A map's boss roster as one merged strip: each boss shows its face
 * portrait, name, and spawn chance. Ported in spirit from
 * `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s boss strip,
 * resolving names + portraits from the JSON API's `mobs` metadata (see
 * `join-json-api-data.ts`). Conditional bosses (night-only, or a level-gated
 * map variant) carry a small corner glyph via {@link BossPill.badge} instead
 * of the old separate Day/Night labeled sides. Renders nothing for an empty
 * list.
 *
 * Each pill is a real button opening that boss's gear and loot card. Three
 * cues say so without relying on hover alone (touch screens have none): a
 * small backpack glyph always sits in the portrait's bottom-right corner, a
 * single light sheen sweeps across the portraits whenever a map is shown,
 * and on hover or keyboard focus the portrait lifts and zooms slightly. The
 * motion is skipped entirely under `prefers-reduced-motion`.
 */
export function BossStrip({ pills, onSelect, sheenKey }: Props) {
  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {pills.map((pill, index) => (
        <button
          // Composite key: two distinct mob codes can resolve to the same
          // display name, so the name alone isn't guaranteed unique.
          key={`${pill.name}-${String(index)}`}
          type="button"
          aria-haspopup="dialog"
          title={titleFor(pill)}
          onClick={(event) => {
            onSelect(pill, event.currentTarget);
          }}
          className="group focus-visible:ring-ring flex w-14 cursor-pointer flex-col items-center gap-0.5 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <BossPortrait
            pill={pill}
            className="h-11 w-11 transition duration-200 group-hover:shadow-md group-hover:brightness-110 group-focus-visible:shadow-md motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:-translate-y-0.5"
          >
            {pill.badge && (
              // Night / level-gate glyph, top-left so it never collides with
              // the gear-and-loot glyph (bottom-right).
              <span
                aria-hidden="true"
                className="bg-card/90 text-foreground absolute top-0 left-0 rounded-br px-1 text-[10px] leading-tight"
              >
                {pill.badge.icon}
              </span>
            )}
            <span
              aria-hidden="true"
              className="bg-card/90 text-foreground group-hover:text-primary group-focus-visible:text-primary absolute right-0 bottom-0 rounded-tl p-0.5 transition-colors"
            >
              <Backpack className="size-2.5" />
            </span>
            {/* One-shot light sweep. Keyed on `sheenKey` so switching maps
                remounts it and plays it again; the per-pill delay turns it
                into a left-to-right wave. Hidden outright (not just
                unanimated) under reduced motion, since without its animation
                the band would sit frozen mid-portrait. */}
            <span
              key={sheenKey}
              aria-hidden="true"
              style={{ animationDelay: `${String(300 + index * 90)}ms` }}
              className="motion-safe:animate-boss-sheen pointer-events-none absolute inset-0 hidden bg-[linear-gradient(105deg,transparent_35%,rgb(255_255_255/0.45)_50%,transparent_65%)] motion-safe:block"
            />
          </BossPortrait>
          <span className="w-full truncate text-[10px] leading-tight">{pill.name}</span>
          <span className={cn("text-xs font-bold tabular-nums", TONE_TEXT[pill.tone])}>
            {spawnChanceText(pill)}
          </span>
        </button>
      ))}
    </div>
  );
}
