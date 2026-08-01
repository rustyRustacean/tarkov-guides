import { cn } from "@/shared/ui/lib/cn";

import type { BossPill, BossPillTone, BossStripSide } from "../lib/boss-groups";

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

interface Props {
  side: BossStripSide | null;
}

/**
 * One labeled set of boss cards (Day, Night, or a variant-set label like
 * "★ Lvl 21+") for a map. Each boss shows its face portrait, name, and spawn
 * chance - ported in spirit from `old/TarkovTrackerWB-main/src/components/
 * maps/mapHeader.js`'s boss strip, resolving names + portraits from the JSON
 * API's `mobs` metadata (see `join-json-api-data.ts`). Renders nothing for a
 * `null`/empty side.
 */
export function BossStrip({ side }: Props) {
  if (!side || side.pills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      <span className="text-muted-foreground self-center text-xs font-semibold tracking-wide uppercase">
        {side.label}
      </span>
      {side.pills.map((pill, index) => (
        <div
          // Composite key: two distinct mob codes can resolve to the same
          // display name, so the name alone isn't guaranteed unique.
          key={`${pill.name}-${String(index)}`}
          title={`${pill.name} · ${chanceText(pill)} spawn chance${pill.count > 1 ? ` · ${String(pill.count)} grouped` : ""}`}
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
            {pill.count > 1 && (
              <span className="bg-card/90 text-foreground absolute right-0 bottom-0 rounded-tl px-1 text-[9px] font-bold tabular-nums">
                ×{pill.count}
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
