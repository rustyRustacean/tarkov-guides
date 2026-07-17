import { cn } from "@/shared/ui/lib/cn";

import type { BossPill, BossPillTone, BossStripSide } from "../lib/boss-groups";

const TONE_CLASSES: Readonly<Record<BossPillTone, string>> = {
  hot: "bg-status-red-soft border-status-red text-status-red",
  warm: "bg-status-amber-soft border-status-amber text-status-amber",
  cool: "bg-status-teal-soft border-status-teal text-status-teal",
  mute: "bg-muted border-border text-muted-foreground",
};

function chanceText(pill: BossPill): string {
  return `${String(Math.round(pill.chance * 100))}%`;
}

interface Props {
  side: BossStripSide | null;
}

/**
 * One labeled set of boss-spawn-chance pills (Day, Night, or a variant-set
 * label like "★ Lvl 21+") - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapHeader.js`'s `buildBossStripHtml`. Renders nothing for
 * a `null`/empty side, matching legacy's own empty-string behavior (no
 * empty-but-labeled panel).
 */
export function BossStrip({ side }: Props) {
  if (!side || side.pills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {side.label}
      </span>
      {side.pills.map((pill) => (
        <span
          key={pill.name}
          title={`${pill.name} · ${chanceText(pill)} spawn chance${pill.count > 1 ? ` · ${String(pill.count)} variants grouped` : ""}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
            TONE_CLASSES[pill.tone],
          )}
        >
          <span>{pill.name}</span>
          <span className="font-bold tabular-nums">{chanceText(pill)}</span>
        </span>
      ))}
    </div>
  );
}
