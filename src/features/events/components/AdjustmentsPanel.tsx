"use client";

import { Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { PROFILE_MODE_LABELS, type ProfileMode } from "@/features/progress-tracker/types";
import { Button } from "@/shared/ui/button/Button";

import { newId } from "../lib/defaults";
import { cleanText, EVENT_LIMITS } from "../lib/event-schema";
import { hasSeparateBoards } from "../lib/scoring";

import { formatPoints, INPUT_CLASS, LABEL_CLASS } from "./event-ui";
import { NumberField } from "./NumberField";

import type { EventEditor } from "../room/use-event-editor";
import type { EventDocument } from "../types";
import type { SubmitEvent } from "react";

/**
 * One-off bonuses and deductions outside any raid, e.g. -10 for showing up
 * with a banned item. Viewers see the list too, so a deduction is never a
 * mystery on the leaderboard.
 */
export function AdjustmentsPanel({ doc, editor }: { doc: EventDocument; editor?: EventEditor }) {
  const teams = useMemo(
    () => Object.values(doc.teams).sort((a, b) => a.order - b.order),
    [doc.teams],
  );
  const separate = hasSeparateBoards(doc.settings);
  const adjustments = Object.values(doc.adjustments).sort((a, b) => b.createdAt - a.createdAt);

  const [teamId, setTeamId] = useState("");
  const [mode, setMode] = useState<ProfileMode | "">("");
  const [points, setPoints] = useState(-10);
  const [reason, setReason] = useState("");
  const teamFieldId = useId();
  const modeFieldId = useId();
  const pointsFieldId = useId();
  const reasonFieldId = useId();

  const chosenTeam = doc.teams[teamId];
  const needsMode = separate && mode === "";
  const canAdd = chosenTeam !== undefined && points !== 0 && !needsMode;

  const add = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || !chosenTeam || !canAdd) return;
    editor.addAdjustment(
      {
        id: newId(),
        teamId: chosenTeam.id,
        mode: mode === "" ? null : mode,
        points,
        reason: cleanText(reason, EVENT_LIMITS.reason),
        createdAt: Date.now(),
      },
      chosenTeam.name,
    );
    setReason("");
  };

  return (
    <div className="flex flex-col gap-6">
      {editor && teams.length > 0 && (
        <form
          onSubmit={add}
          className="grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto_8rem] sm:items-end"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={teamFieldId} className={LABEL_CLASS}>
              Team
            </label>
            <select
              id={teamFieldId}
              className={INPUT_CLASS}
              value={teamId}
              onChange={(event) => {
                setTeamId(event.target.value);
              }}
            >
              <option value="">Pick a team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          {doc.settings.modes.length > 1 ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={modeFieldId} className={LABEL_CLASS}>
                Leaderboard
              </label>
              <select
                id={modeFieldId}
                className={INPUT_CLASS}
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as ProfileMode | "");
                }}
              >
                <option value="">{separate ? "Pick a mode" : "Overall"}</option>
                {doc.settings.modes.map((value) => (
                  <option key={value} value={value}>
                    {PROFILE_MODE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span />
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor={pointsFieldId} className={LABEL_CLASS}>
              Points
            </label>
            <NumberField
              id={pointsFieldId}
              min={-EVENT_LIMITS.maxPoints}
              max={EVENT_LIMITS.maxPoints}
              value={points}
              onChange={setPoints}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={reasonFieldId} className={LABEL_CLASS}>
              Reason
            </label>
            <input
              id={reasonFieldId}
              className={INPUT_CLASS}
              maxLength={EVENT_LIMITS.reason}
              placeholder="e.g. Brought a banned item"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </div>
          <Button type="submit" disabled={!canAdd}>
            Add
          </Button>
        </form>
      )}

      {adjustments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No adjustments.</p>
      ) : (
        <ul className="border-border divide-border max-w-3xl divide-y rounded-lg border">
          {adjustments.map((adjustment) => {
            const team = doc.teams[adjustment.teamId];
            return (
              <li key={adjustment.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span
                  className={`w-16 font-bold tabular-nums ${adjustment.points < 0 ? "text-status-red" : "text-status-green"}`}
                >
                  {adjustment.points > 0 ? "+" : ""}
                  {formatPoints(adjustment.points)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{team?.name}</span>
                  {adjustment.reason && (
                    <span className="text-muted-foreground"> · {adjustment.reason}</span>
                  )}
                  {adjustment.mode && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {PROFILE_MODE_LABELS[adjustment.mode]}
                    </span>
                  )}
                </span>
                {editor && team && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${String(adjustment.points)} for ${team.name}`}
                    onClick={() => {
                      editor.deleteAdjustment(adjustment, team.name);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
