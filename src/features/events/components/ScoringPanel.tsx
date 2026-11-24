"use client";

import { MinusCircle, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import {
  PROFILE_MODE_LABELS,
  PROFILE_MODES,
  type ProfileMode,
} from "@/features/progress-tracker/types";
import { useTarkovIndexes } from "@/shared/lib/tarkov-api/use-tarkov-indexes";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { ItemIcon } from "@/shared/ui/item-icon/ItemIcon";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { MAX_RAIDS_PER_MODE, newId } from "../lib/defaults";
import { cleanText, EVENT_LIMITS } from "../lib/event-schema";
import {
  TEAM_SIZE_LABELS,
  TEAM_SIZES,
  type EventDocument,
  type EventSettings,
  type ScoreColumn,
  type TeamSize,
} from "../types";

import { INPUT_CLASS, LABEL_CLASS } from "./event-ui";
import { ItemPicker } from "./ItemPicker";
import { NumberField } from "./NumberField";

import type { EventEditor } from "../room/use-event-editor";

interface Draft {
  settings: EventSettings;
  columns: ScoreColumn[];
}

const MAX_TIEBREAKERS = 3;

function ModeCheckboxes({
  modes,
  onChange,
}: {
  modes: readonly ProfileMode[];
  onChange: (modes: ProfileMode[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={LABEL_CLASS}>Game modes</legend>
      <div className="flex flex-wrap gap-4">
        {PROFILE_MODES.map((mode) => {
          const checked = modes.includes(mode);
          return (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={checked}
                // The last mode can't be unticked: an event needs one.
                disabled={checked && modes.length === 1}
                onChange={() => {
                  onChange(
                    checked
                      ? modes.filter((m) => m !== mode)
                      : PROFILE_MODES.filter((m) => m === mode || modes.includes(m)),
                  );
                }}
              />
              {PROFILE_MODE_LABELS[mode]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Event settings and score columns. Edits collect in a draft and apply
 * together with Save, so a half-finished change (e.g. per-mode points
 * filled in for one mode only) never rescores the live board. If another
 * editor saves while you have a draft open, you're told and can load theirs.
 */
export function ScoringPanel({ doc, editor }: { doc: EventDocument; editor: EventEditor }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [base, setBase] = useState<string>("");
  const current: Draft = { settings: doc.settings, columns: doc.columns };
  const view = draft ?? current;
  const { settings, columns } = view;
  const changedElsewhere = draft !== null && base !== JSON.stringify(current);
  const multiMode = settings.modes.length > 1;
  const nameId = useId();
  const indexes = useTarkovIndexes();

  const edit = (change: (draft: Draft) => Draft) => {
    if (draft === null) setBase(JSON.stringify(current));
    setDraft(change(view));
  };
  const editSettings = (patch: Partial<EventSettings>) => {
    edit((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  };
  const editColumn = (id: string, patch: Partial<ScoreColumn>) => {
    edit((d) => ({
      ...d,
      columns: d.columns.map((column) => (column.id === id ? { ...column, ...patch } : column)),
    }));
  };
  const addColumn = (column: ScoreColumn) => {
    edit((d) => ({ ...d, columns: [...d.columns, column] }));
  };

  const save = () => {
    if (!draft) return;
    const name = cleanText(draft.settings.name, EVENT_LIMITS.eventName) || doc.settings.name;
    const nextSettings = { ...draft.settings, name };
    if (JSON.stringify(nextSettings) !== JSON.stringify(doc.settings)) {
      editor.setSettings(nextSettings, "Updated event settings");
    }
    if (JSON.stringify(draft.columns) !== JSON.stringify(doc.columns)) {
      editor.setColumns(draft.columns, "Updated score columns");
    }
    setDraft(null);
  };

  const setModes = (modes: ProfileMode[]) => {
    const raidsPerMode = { ...settings.raidsPerMode };
    for (const mode of modes) raidsPerMode[mode] ??= 3;
    editSettings({ modes, raidsPerMode });
  };

  const enabledColumns = columns.filter((column) => column.enabled);
  const atColumnLimit = columns.length >= EVENT_LIMITS.columns;

  return (
    <div className="flex flex-col gap-6">
      {draft && (
        <div
          role="status"
          className="border-status-amber bg-card sticky top-[calc(var(--header-height)+0.5rem)] z-10 flex flex-wrap items-center gap-3 rounded-lg border p-3 shadow"
        >
          <p className="flex-1 text-sm">
            {changedElsewhere
              ? "Someone else changed these settings while you were editing."
              : "Unsaved changes. The leaderboard updates when you save."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(null);
            }}
          >
            {changedElsewhere ? "Load their changes" : "Discard"}
          </Button>
          <Button size="sm" onClick={save}>
            Save changes
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Event</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex max-w-xl flex-col gap-1">
            <label htmlFor={nameId} className={LABEL_CLASS}>
              Name
            </label>
            <input
              id={nameId}
              className={INPUT_CLASS}
              maxLength={EVENT_LIMITS.eventName}
              value={settings.name}
              onChange={(event) => {
                editSettings({ name: event.target.value });
              }}
            />
          </div>

          <ModeCheckboxes modes={settings.modes} onChange={setModes} />
          <p className="text-muted-foreground -mt-3 text-xs">
            Raids logged in a mode you remove are hidden, not deleted, and come back if you add the
            mode again.
          </p>

          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS} id="team-size-label">
              Team size
            </span>
            <SegmentedControl
              aria-labelledby="team-size-label"
              className="max-w-xl"
              options={TEAM_SIZES.map((size) => ({
                value: String(size),
                label: TEAM_SIZE_LABELS[size],
              }))}
              value={String(settings.teamSize)}
              onChange={(value) => {
                editSettings({ teamSize: Number(value) as TeamSize });
              }}
            />
            <p className="text-muted-foreground text-xs">
              Also caps &quot;Players survived&quot; per raid.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {settings.modes.map((mode) => (
              <div key={mode} className="flex w-36 flex-col gap-1">
                <label className={LABEL_CLASS} htmlFor={`raids-${mode}`}>
                  {multiMode ? `${PROFILE_MODE_LABELS[mode]} raids` : "Raids per team"}
                </label>
                <NumberField
                  id={`raids-${mode}`}
                  integer
                  min={1}
                  max={MAX_RAIDS_PER_MODE}
                  value={settings.raidsPerMode[mode] ?? 3}
                  onChange={(raids) => {
                    editSettings({ raidsPerMode: { ...settings.raidsPerMode, [mode]: raids } });
                  }}
                />
              </div>
            ))}
          </div>

          {multiMode && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className={LABEL_CLASS} id="leaderboard-mode-label">
                  Leaderboard
                </span>
                <SegmentedControl
                  aria-labelledby="leaderboard-mode-label"
                  className="max-w-md"
                  options={[
                    { value: "combined", label: "One combined board" },
                    { value: "separate", label: "One board per mode" },
                  ]}
                  value={settings.leaderboard}
                  onChange={(leaderboard) => {
                    editSettings({ leaderboard });
                  }}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={settings.scoringPerMode}
                  onChange={() => {
                    editSettings({ scoringPerMode: !settings.scoringPerMode });
                  }}
                />
                Different points per mode (e.g. PvE PMC kills worth less)
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={settings.bestRaids !== null}
                onChange={() => {
                  editSettings({ bestRaids: settings.bestRaids === null ? 2 : null });
                }}
              />
              Only count each team&apos;s best
            </label>
            {settings.bestRaids !== null && (
              <>
                <NumberField
                  aria-label="Raids that count"
                  className="w-20"
                  integer
                  min={1}
                  max={MAX_RAIDS_PER_MODE}
                  value={settings.bestRaids}
                  onChange={(bestRaids) => {
                    editSettings({ bestRaids });
                  }}
                />
                <span className="text-sm">raids per mode</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raid multipliers</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            A raid&apos;s points are multiplied by this, e.g. 2 makes the final raid count double.
          </p>
          {settings.modes.map((mode) => (
            <div key={mode} className="flex flex-col gap-2">
              {multiMode && <span className={LABEL_CLASS}>{PROFILE_MODE_LABELS[mode]}</span>}
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: settings.raidsPerMode[mode] ?? 0 }, (_, i) => i + 1).map(
                  (raid) => (
                    <label key={raid} className="flex items-center gap-2 text-sm">
                      Raid {raid} ×
                      <NumberField
                        className="w-20"
                        aria-label={`${PROFILE_MODE_LABELS[mode]} raid ${String(raid)} multiplier`}
                        min={0}
                        max={EVENT_LIMITS.maxMultiplier}
                        step={0.5}
                        value={settings.raidMultipliers[mode]?.[String(raid)] ?? 1}
                        onChange={(factor) => {
                          const perRaid = Object.fromEntries(
                            Object.entries(settings.raidMultipliers[mode] ?? {}).filter(
                              ([key]) => key !== String(raid),
                            ),
                          );
                          if (factor !== 1) perRaid[String(raid)] = factor;
                          editSettings({
                            raidMultipliers: { ...settings.raidMultipliers, [mode]: perRaid },
                          });
                        }}
                      />
                    </label>
                  ),
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score columns</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted text-muted-foreground text-xs uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">
                    On
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Column
                  </th>
                  {settings.scoringPerMode && multiMode ? (
                    settings.modes.map((mode) => (
                      <th key={mode} scope="col" className="px-3 py-2 text-left">
                        {PROFILE_MODE_LABELS[mode]} pts
                      </th>
                    ))
                  ) : (
                    <th scope="col" className="px-3 py-2 text-left">
                      Points each
                    </th>
                  )}
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {columns.map((column) => (
                  <tr key={column.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <Checkbox
                        aria-label={`Use ${column.label}`}
                        checked={column.enabled}
                        onChange={() => {
                          editColumn(column.id, { enabled: !column.enabled });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {column.kind === "item" && (
                          <ItemIcon
                            src={column.itemId ? indexes.items.byId[column.itemId]?.iconLink : null}
                            size="xs"
                          />
                        )}
                        <input
                          aria-label="Column name"
                          className={`${INPUT_CLASS} min-w-40 py-1`}
                          maxLength={EVENT_LIMITS.columnLabel}
                          value={column.label}
                          onChange={(event) => {
                            editColumn(column.id, { label: event.target.value });
                          }}
                        />
                        {column.kind !== "builtin" && (
                          <Badge variant={column.kind === "penalty" ? "red" : "outline"}>
                            {column.kind === "item"
                              ? "Item"
                              : column.kind === "penalty"
                                ? "Penalty"
                                : "Custom"}
                          </Badge>
                        )}
                      </div>
                    </td>
                    {(settings.scoringPerMode && multiMode
                      ? settings.modes
                      : (["all"] as const)
                    ).map((key) => (
                      <td key={key} className="px-3 py-2">
                        <NumberField
                          className="w-24 py-1"
                          aria-label={`${column.label} points${key === "all" ? "" : ` in ${PROFILE_MODE_LABELS[key]}`}`}
                          min={-EVENT_LIMITS.maxPoints}
                          max={EVENT_LIMITS.maxPoints}
                          step={0.5}
                          value={
                            key === "all"
                              ? (column.points.all ?? 0)
                              : (column.points[key] ?? column.points.all ?? 0)
                          }
                          onChange={(points) => {
                            editColumn(column.id, { points: { ...column.points, [key]: points } });
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {column.kind !== "builtin" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${column.label}`}
                          onClick={() => {
                            edit((d) => ({
                              ...d,
                              columns: d.columns.filter((c) => c.id !== column.id),
                              settings: {
                                ...d.settings,
                                tiebreakers: d.settings.tiebreakers.filter((t) => t !== column.id),
                              },
                            }));
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            Default columns can be switched off but not removed. Penalties take points away: give
            them a negative value.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={atColumnLimit}
              onClick={() => {
                addColumn({
                  id: newId(),
                  kind: "custom",
                  label: "New column",
                  points: { all: 1 },
                  enabled: true,
                });
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Custom column
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={atColumnLimit}
              onClick={() => {
                addColumn({
                  id: newId(),
                  kind: "penalty",
                  label: "Rule break",
                  points: { all: -10 },
                  enabled: true,
                });
              }}
            >
              <MinusCircle className="size-4" aria-hidden="true" />
              Penalty
            </Button>
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <span className={LABEL_CLASS}>Item bonus</span>
            <ItemPicker
              label="Add an item bonus column"
              placeholder="e.g. Physical Bitcoin"
              onPick={(item) => {
                if (atColumnLimit) return;
                addColumn({
                  id: newId(),
                  kind: "item",
                  itemId: item.id,
                  label: cleanText(item.shortName || item.name, EVENT_LIMITS.columnLabel),
                  points: { all: 10 },
                  enabled: true,
                });
              }}
            />
            <p className="text-muted-foreground text-xs">
              Points per item extracted, counted per raid like any other column.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiebreakers</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Teams on the same total are ordered by these, in turn (more is better). Teams still
            level share a place.
          </p>
          {Array.from({ length: MAX_TIEBREAKERS }, (_, i) => (
            <label key={i} className="flex max-w-sm items-center gap-3 text-sm">
              <span className="w-6 tabular-nums">{i + 1}.</span>
              <select
                className={INPUT_CLASS}
                value={settings.tiebreakers[i] ?? ""}
                disabled={i > settings.tiebreakers.length}
                onChange={(event) => {
                  const next = settings.tiebreakers.slice(0, i);
                  if (event.target.value) next.push(event.target.value);
                  next.push(
                    ...settings.tiebreakers.slice(i + 1).filter((t) => t !== event.target.value),
                  );
                  editSettings({ tiebreakers: next.slice(0, MAX_TIEBREAKERS) });
                }}
              >
                <option value="">{i === 0 ? "None" : "Nothing more"}</option>
                {enabledColumns
                  .filter(
                    (column) =>
                      column.id === settings.tiebreakers[i] ||
                      !settings.tiebreakers.includes(column.id),
                  )
                  .map((column) => (
                    <option key={column.id} value={column.id}>
                      Most {column.label.toLowerCase()}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
