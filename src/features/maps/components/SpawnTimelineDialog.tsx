"use client";

import { PROFILE_MODE_LABELS } from "@/features/progress-tracker/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { cn } from "@/shared/ui/lib/cn";

import { describeSquadSize } from "../lib/boss-loadout";
import { buildSpawnTimeline, formatRaidClock, unnamedSwitchesFor } from "../lib/boss-spawns";

import { BossPortrait, TONE_TEXT, spawnChanceText } from "./BossStrip";

import type { BossPill } from "../lib/boss-groups";
import type { TimelineSubject } from "../lib/boss-spawns";
import type { ProfileMode } from "@/features/progress-tracker/types";
import type { RefObject } from "react";

const SECTION_HEADING = "font-display text-sm font-semibold tracking-wide uppercase";
const SUBHEADING = "text-muted-foreground text-[10px] font-semibold tracking-wide uppercase";

interface SubjectProps {
  subject: TimelineSubject;
  /** A time upstream pairs with a switch trigger, shown without interpretation. */
  linkedSeconds?: number | null;
}

/** One enemy on the timeline: face, name, chance, group size, and where it can appear. */
function Subject({ subject, linkedSeconds = null }: SubjectProps) {
  return (
    <li className="flex items-start gap-2">
      <BossPortrait pill={subject} className="h-8 w-8" />
      <div className="min-w-0 text-sm">
        <p>
          <span className="font-semibold">{subject.name}</span>
          {subject.badge && (
            <>
              {" "}
              <span aria-hidden="true" title={subject.badge.title}>
                {subject.badge.icon}
              </span>
              <span className="sr-only">({subject.badge.title})</span>
            </>
          )}{" "}
          <span className={cn("font-semibold tabular-nums", TONE_TEXT[subject.tone])}>
            {spawnChanceText(subject)}
          </span>
          {subject.note && <span className="text-muted-foreground"> ({subject.note})</span>}
          {subject.groupSize && (
            <span className="text-muted-foreground">
              {" "}
              · groups of {describeSquadSize(subject.groupSize)}
            </span>
          )}
        </p>
        {subject.zones.length > 0 && (
          <p className="text-muted-foreground text-xs">{subject.zones.join(", ")}</p>
        )}
        {linkedSeconds !== null && (
          <p
            className="text-muted-foreground text-xs"
            title="tarkov.dev's data pairs this time with the switch. What the game does with it isn't documented."
          >
            Linked time: {formatRaidClock(linkedSeconds)}
          </p>
        )}
      </div>
    </li>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** The strip's pills for the current map, mode and Ground Zero queue. */
  pills: readonly BossPill[];
  /** Display name of the map, for the title. */
  mapName: string;
  /** The map entry the roster comes from (Ground Zero's queue entry), for map-specific notes. */
  mapEntry: string;
  mode: ProfileMode;
  /** Raid length in minutes; `null` when unknown. */
  raidMinutes: number | null;
  /** The button that opened the timeline; focus goes back to it on close. */
  returnFocusTo: RefObject<HTMLButtonElement | null>;
}

/**
 * Everything time- or trigger-related on one map for the active mode, opened
 * from the "Spawn timeline" button after the boss strip's pills (see
 * `MapBossStrips`), which only shows when there's something beyond raid
 * start. Timed spawns run earliest first, a time past the raid's own length
 * flagged rather than dropped (Terminal lists its visiting bosses at 96:30
 * in a 50 min raid). Switch-triggered spawns are grouped by switch, the
 * Goons' random timing gets its own short list, and the raid-start roster
 * sits collapsed at the end for completeness. Scripted spawns (upstream's
 * `9999`-style placeholders) aren't listed: they're not on a timer at all,
 * which their own cards say.
 *
 * Opened from state like the boss card, so `returnFocusTo` hands focus back
 * explicitly on close.
 */
export function SpawnTimelineDialog({
  open,
  onClose,
  pills,
  mapName,
  mapEntry,
  mode,
  raidMinutes,
  returnFocusTo,
}: Props) {
  const timeline = open ? buildSpawnTimeline(pills, raidMinutes) : null;
  const unnamed = unnamedSwitchesFor(mapEntry);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {timeline && (
        <DialogContent
          className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo.current?.focus();
          }}
        >
          <DialogHeader className="border-border border-b p-4 pr-12">
            <DialogTitle>{mapName} spawn timeline</DialogTitle>
            <DialogDescription>
              {PROFILE_MODE_LABELS[mode]}
              {raidMinutes ? ` · ${String(raidMinutes)} min raid` : ""}. Possible spawns from
              tarkov.dev&apos;s data: each one only happens if its chance rolls.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            {timeline.timed.length > 0 && (
              <section>
                <h3 className={SECTION_HEADING}>During the raid</h3>
                <ol className="border-border mt-2 flex flex-col gap-3 border-l pl-3">
                  {timeline.timed.map((row) => (
                    <li key={row.seconds} className="flex gap-3">
                      <div className="w-16 shrink-0">
                        <time
                          dateTime={`PT${String(row.seconds)}S`}
                          className="font-display text-sm font-semibold tabular-nums"
                        >
                          {formatRaidClock(row.seconds)}
                        </time>
                        {row.pastRaid && raidMinutes !== null && (
                          <p className="text-status-amber text-[10px] leading-tight">
                            after the {raidMinutes} min raid ends
                          </p>
                        )}
                      </div>
                      <ul className="flex min-w-0 flex-1 flex-col gap-2">
                        {row.subjects.map((subject, index) => (
                          <Subject key={`${subject.name}-${String(index)}`} subject={subject} />
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {timeline.random.length > 0 && (
              <section>
                <h3 className={SECTION_HEADING}>At a random time</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {timeline.random.map((subject, index) => (
                    <Subject key={`${subject.name}-${String(index)}`} subject={subject} />
                  ))}
                </ul>
              </section>
            )}
            {timeline.triggered.length > 0 && (
              <section>
                <h3 className={SECTION_HEADING}>Triggered by switches</h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Using one of these switches, usually to open an extract, can spawn these if the
                  chance rolls.
                </p>
                <div className="mt-2 flex flex-col gap-3">
                  {timeline.triggered.map((group) => (
                    <div key={group.switchName ?? "unnamed"}>
                      <h4 className={SUBHEADING}>{group.switchName ?? unnamed.title}</h4>
                      {group.switchName === null && (
                        <p className="text-muted-foreground mt-0.5 text-xs">{unnamed.note}</p>
                      )}
                      <ul className="mt-1.5 flex flex-col gap-2">
                        {group.subjects.map((subject, index) => (
                          <Subject
                            key={`${subject.name}-${String(index)}`}
                            subject={subject}
                            linkedSeconds={subject.linkedSeconds}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {timeline.atStart.length > 0 && (
              <details>
                <summary className={cn(SECTION_HEADING, "cursor-pointer")}>
                  At raid start{" "}
                  <span className="text-muted-foreground font-normal normal-case">
                    ({timeline.atStart.length})
                  </span>
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {timeline.atStart.map((subject, index) => (
                    <Subject key={`${subject.name}-${String(index)}`} subject={subject} />
                  ))}
                </ul>
              </details>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
