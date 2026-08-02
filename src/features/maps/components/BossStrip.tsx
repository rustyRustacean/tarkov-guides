import { cn } from "@/shared/ui/lib/cn";

import type { BossPill, BossPillTone } from "../lib/boss-groups";

/** Border color per threat tone - rings the portrait. */
const TONE_BORDER: Readonly<Record<BossPillTone, string>> = {
  hot: "border-status-red",
  warm: "border-status-amber",
  cool: "border-status-teal",
  mute: "border-border",
};

/** Chance-figure text color per threat tone. */
const TONE_TEXT: Readonly<Record<BossPillTone, string>> = {
  hot: "text-status-red",
  warm: "text-status-amber",
  cool: "text-status-teal",
  mute: "text-muted-foreground",
};

function chanceText(pill: BossPill): string {
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
  return `${pill.name} · ${chanceText(pill)} spawn chance${condition}`;
}

interface Props {
  pills: readonly BossPill[];
}

/**
 * A map's boss roster as one merged strip - each boss shows its face
 * portrait, name, and spawn chance. Ported in spirit from
 * `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s boss strip,
 * resolving names + portraits from the JSON API's `mobs` metadata (see
 * `join-json-api-data.ts`). Conditional bosses (night-only, or a level-gated
 * map variant) carry a small corner glyph via {@link BossPill.badge} instead
 * of the old separate Day/Night labeled sides. Renders nothing for an empty
 * list.
 */
export function BossStrip({ pills }: Props) {
  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {pills.map((pill, index) => (
        <div
          // Composite key: two distinct mob codes can resolve to the same
          // display name, so the name alone isn't guaranteed unique.
          key={`${pill.name}-${String(index)}`}
          title={titleFor(pill)}
          className="flex w-14 flex-col items-center gap-0.5 text-center"
        >
          <div
            className={cn(
              "bg-muted relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border-2",
              TONE_BORDER[pill.tone],
            )}
          >
            {pill.imagePortraitLink ? (
              // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted portrait, not a local/optimizable asset.
              <img
                src={pill.imagePortraitLink}
                alt=""
                className="h-full w-full object-cover"
                onError={(event) => {
                  // Missing/blocked asset - drop the img so the initials fallback shows.
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span className="text-muted-foreground text-[11px] font-semibold">
                {initials(pill.name)}
              </span>
            )}
            {pill.badge && (
              // Night / level-gate glyph, top-left so it never collides with
              // the ×count badge (bottom-right).
              <span
                aria-hidden="true"
                className="bg-card/90 text-foreground absolute top-0 left-0 rounded-br px-1 text-[10px] leading-tight"
              >
                {pill.badge.icon}
              </span>
            )}
          </div>
          <span className="w-full truncate text-[10px] leading-tight">{pill.name}</span>
          <span className={cn("text-xs font-bold tabular-nums", TONE_TEXT[pill.tone])}>
            {chanceText(pill)}
          </span>
        </div>
      ))}
    </div>
  );
}
