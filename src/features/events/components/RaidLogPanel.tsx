"use client";

import { Eraser } from "lucide-react";
import { useMemo, useState } from "react";

import { PROFILE_MODE_LABELS, type ProfileMode } from "@/features/progress-tracker/types";
import { useTarkovIndexes } from "@/shared/lib/tarkov-api/use-tarkov-indexes";
import { Button } from "@/shared/ui/button/Button";
import { ItemIcon } from "@/shared/ui/item-icon/ItemIcon";
import { QuantityStepper } from "@/shared/ui/quantity-stepper/QuantityStepper";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { EVENT_LIMITS } from "../lib/event-schema";
import { buildLeaderboards, multiplierFor, scoreEntry } from "../lib/scoring";
import { entryIdFor, type EventDocument, type ScoreColumn } from "../types";

import { formatPoints, INPUT_CLASS, LABEL_CLASS } from "./event-ui";

import type { EventEditor } from "../room/use-event-editor";

/** A column header: its label, plus the item's icon for item bonus columns. */
function ColumnHeading({ column, iconLink }: { column: ScoreColumn; iconLink: string | null }) {
  return (
    <span className="inline-flex flex-col items-center gap-1">
      {column.kind === "item" && <ItemIcon src={iconLink} size="xs" />}
      <span>{column.label}</span>
    </span>
  );
}

/**
 * The raid log, laid out the way scoring actually happens: pick a mode and
 * raid number, then fill in every team's row for it. Editors get steppers
 * (writes land in the room immediately, so co-scorers see them live);
 * viewers see the same grid as plain numbers.
 */
export function RaidLogPanel({ doc, editor }: { doc: EventDocument; editor?: EventEditor }) {
  const { settings } = doc;
  const [mode, setMode] = useState<ProfileMode>(settings.modes[0] ?? "PVP");
  const activeMode = settings.modes.includes(mode) ? mode : (settings.modes[0] ?? "PVP");
  const raidCount = settings.raidsPerMode[activeMode] ?? 1;
  const [raid, setRaid] = useState(1);
  const activeRaid = Math.min(Math.max(raid, 1), raidCount);

  const indexes = useTarkovIndexes();
  const columns = doc.columns.filter((column) => column.enabled);
  const teams = useMemo(
    () => Object.values(doc.teams).sort((a, b) => a.order - b.order),
    [doc.teams],
  );
  const { notes } = useMemo(() => buildLeaderboards(doc), [doc]);
  const multiplier = multiplierFor(settings, activeMode, activeRaid);
  const loggedThisRaid = teams.filter(
    (team) => doc.entries[entryIdFor(team.id, activeMode, activeRaid)],
  ).length;

  if (teams.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {editor ? "Add teams on the Teams tab first." : "No teams yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        {settings.modes.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS} id="raid-log-mode">
              Mode
            </span>
            <SegmentedControl
              aria-labelledby="raid-log-mode"
              className="min-w-56"
              options={settings.modes.map((value) => ({
                value,
                label: PROFILE_MODE_LABELS[value],
              }))}
              value={activeMode}
              onChange={setMode}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className={LABEL_CLASS} id="raid-log-raid">
            Raid
          </span>
          <div role="group" aria-labelledby="raid-log-raid" className="flex flex-wrap gap-1">
            {Array.from({ length: raidCount }, (_, i) => i + 1).map((number) => (
              <Button
                key={number}
                size="sm"
                variant={number === activeRaid ? "default" : "outline"}
                aria-pressed={number === activeRaid}
                onClick={() => {
                  setRaid(number);
                }}
              >
                {number}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          {loggedThisRaid} of {teams.length} teams logged
          {multiplier !== 1 && (
            <span className="text-status-amber"> · counts ×{formatPoints(multiplier)}</span>
          )}
        </p>
      </div>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max text-sm">
          <caption className="sr-only">
            {PROFILE_MODE_LABELS[activeMode]} raid {activeRaid}
          </caption>
          <thead className="bg-muted text-muted-foreground text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 text-left uppercase">
                Team
              </th>
              {columns.map((column) => (
                <th key={column.id} scope="col" className="px-2 py-2 text-center font-medium">
                  <ColumnHeading
                    column={column}
                    iconLink={
                      column.itemId ? (indexes.items.byId[column.itemId]?.iconLink ?? null) : null
                    }
                  />
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right uppercase">
                Points
              </th>
              <th scope="col" className="px-3 py-2 text-left uppercase">
                Note
              </th>
              {editor && (
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Clear</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const entry = doc.entries[entryIdFor(team.id, activeMode, activeRaid)];
              const score = entry ? scoreEntry(entry, doc.columns, settings) : null;
              return (
                <tr key={team.id} className="border-border border-t">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {team.name}
                  </th>
                  {columns.map((column) => {
                    const count = entry?.counts[column.id] ?? 0;
                    return (
                      <td key={column.id} className="px-2 py-1.5 text-center">
                        {editor ? (
                          <QuantityStepper
                            className="mx-auto"
                            label={`${team.name} ${column.label}`}
                            value={count}
                            min={0}
                            max={
                              column.builtin === "survived"
                                ? settings.teamSize
                                : EVENT_LIMITS.maxCount
                            }
                            onChange={(next) => {
                              editor.setCount({
                                team,
                                mode: activeMode,
                                raid: activeRaid,
                                column,
                                count: next,
                              });
                            }}
                          />
                        ) : (
                          <span className={count === 0 ? "text-muted-foreground" : "tabular-nums"}>
                            {count}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {score ? (
                      formatPoints(score.total)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="min-w-40 px-3 py-1.5">
                    {editor ? (
                      <NoteField
                        key={`${team.id}:${activeMode}:${String(activeRaid)}:${entry?.note ?? ""}`}
                        label={`${team.name} note`}
                        initial={entry?.note ?? ""}
                        onCommit={(note) => {
                          editor.setNote({ team, mode: activeMode, raid: activeRaid, note });
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground">{entry?.note}</span>
                    )}
                  </td>
                  {editor && (
                    <td className="px-2 py-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!entry}
                        aria-label={`Clear ${team.name}'s ${PROFILE_MODE_LABELS[activeMode]} raid ${String(activeRaid)}`}
                        onClick={() => {
                          editor.clearEntry({ team, mode: activeMode, raid: activeRaid });
                        }}
                      >
                        <Eraser className="size-4" aria-hidden="true" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {notes.outOfRangeEntryIds.length > 0 && (
        <p className="text-status-amber text-xs">
          {notes.outOfRangeEntryIds.length} logged raid
          {notes.outOfRangeEntryIds.length === 1 ? " is" : "s are"} past the current raid count and{" "}
          {notes.outOfRangeEntryIds.length === 1 ? "doesn't" : "don't"} score. Raise the raid count
          on the Scoring tab to bring {notes.outOfRangeEntryIds.length === 1 ? "it" : "them"} back.
        </p>
      )}
    </div>
  );
}

/** A note input that writes on blur or Enter rather than every keystroke, so the activity log gets one line per note. */
function NoteField({
  label,
  initial,
  onCommit,
}: {
  label: string;
  initial: string;
  onCommit: (note: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const commit = () => {
    if (draft.trim() !== initial) onCommit(draft.trim());
  };
  return (
    <input
      aria-label={label}
      className={`${INPUT_CLASS} py-1`}
      maxLength={EVENT_LIMITS.note}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}
