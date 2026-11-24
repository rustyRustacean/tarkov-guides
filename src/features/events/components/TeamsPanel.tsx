"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent } from "@/shared/ui/card/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { newId } from "../lib/defaults";
import { cleanText, EVENT_LIMITS } from "../lib/event-schema";
import {
  TEAM_SIZE_LABELS,
  type EventDocument,
  type Player,
  type Preset,
  type Team,
} from "../types";

import { INPUT_CLASS, LABEL_CLASS } from "./event-ui";

import type { EventEditor } from "../room/use-event-editor";
import type { SubmitEvent } from "react";

/**
 * A roster padded to the event's team size, so every player slot has a
 * field. Empty slots get an id derived from the team and position, not a
 * random one: a fresh id each render would remount the slot's input and
 * drop whatever someone was typing into it.
 */
function rosterSlots(teamId: string, players: readonly Player[], teamSize: number): Player[] {
  return Array.from(
    { length: teamSize },
    (_, i) => players[i] ?? { id: `${teamId}-p${String(i + 1)}`, name: "", roleId: null },
  );
}

/** A text field that writes on blur or Enter, so typing a name doesn't log every keystroke. */
function CommitField({
  label,
  initial,
  maxLength,
  placeholder,
  onCommit,
}: {
  label: string;
  initial: string;
  maxLength: number;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const commit = () => {
    const value = cleanText(draft, maxLength);
    if (value !== initial) onCommit(value);
  };
  return (
    <input
      aria-label={label}
      className={INPUT_CLASS}
      maxLength={maxLength}
      placeholder={placeholder}
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

function TeamCard({
  team,
  teamSize,
  presets,
  editor,
  onDelete,
}: {
  team: Team;
  teamSize: number;
  presets: readonly Preset[];
  editor?: EventEditor;
  onDelete: () => void;
}) {
  const players = rosterSlots(team.id, team.players, teamSize);
  const roleName = (roleId: string | null) =>
    roleId ? presets.find((preset) => preset.id === roleId)?.name : undefined;

  if (!editor) {
    const named = team.players.filter((player) => player.name || roleName(player.roleId));
    return (
      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <p className="font-semibold">{team.name}</p>
          {named.length === 0 ? (
            <p className="text-muted-foreground text-sm">No player names yet</p>
          ) : (
            <ul className="text-sm">
              {named.map((player, i) => (
                <li key={player.id}>
                  {player.name || `Player ${String(i + 1)}`}
                  {roleName(player.roleId) && (
                    <span className="text-muted-foreground"> · {roleName(player.roleId)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <CommitField
            key={team.name}
            label="Team name"
            initial={team.name}
            maxLength={EVENT_LIMITS.teamName}
            onCommit={(name) => {
              if (name)
                editor.upsertTeam({ ...team, name }, `Renamed team ${team.name} to ${name}`);
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove team ${team.name}`}
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {players.map((player, index) => (
            <div key={player.id} className="flex flex-col gap-1">
              <CommitField
                key={`${player.id}:${player.name}`}
                label={`${team.name} player ${String(index + 1)}`}
                placeholder={`Player ${String(index + 1)}`}
                initial={player.name}
                maxLength={EVENT_LIMITS.playerName}
                onCommit={(name) => {
                  const next = players.map((slot, i) => (i === index ? { ...slot, name } : slot));
                  editor.upsertTeam({ ...team, players: next }, `Updated ${team.name}'s roster`);
                }}
              />
              {presets.length > 0 && (
                <select
                  aria-label={`${team.name} player ${String(index + 1)} role`}
                  className={`${INPUT_CLASS} py-1 text-xs`}
                  value={player.roleId ?? ""}
                  onChange={(event) => {
                    const roleId = event.target.value || null;
                    const next = players.map((slot, i) =>
                      i === index ? { ...slot, roleId } : slot,
                    );
                    editor.upsertTeam(
                      { ...team, players: next },
                      `${player.name || `${team.name} player ${String(index + 1)}`}: role ${roleName(roleId) ?? "none"}`,
                    );
                  }}
                >
                  <option value="">No role</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Teams and their rosters. Editors can add, rename and remove teams; rosters have one slot per player in the event's team size. */
export function TeamsPanel({ doc, editor }: { doc: EventDocument; editor?: EventEditor }) {
  const { teamSize } = doc.settings;
  const teams = useMemo(
    () => Object.values(doc.teams).sort((a, b) => a.order - b.order),
    [doc.teams],
  );
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null);
  const presets = useMemo(() => Object.values(doc.presets), [doc.presets]);
  const atLimit = teams.length >= EVENT_LIMITS.teams;

  const addTeam = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = cleanText(name, EVENT_LIMITS.teamName);
    if (!clean || !editor || atLimit) return;
    const order = teams.reduce((max, team) => Math.max(max, team.order), -1) + 1;
    const id = newId();
    editor.upsertTeam(
      { id, name: clean, order, players: rosterSlots(id, [], teamSize) },
      `Added team ${clean}`,
    );
    setName("");
  };

  const pendingEntries = pendingDelete
    ? Object.values(doc.entries).filter((entry) => entry.teamId === pendingDelete.id).length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {teams.length} {teams.length === 1 ? "team" : "teams"} ·{" "}
        {TEAM_SIZE_LABELS[doc.settings.teamSize]}
      </p>

      {editor && (
        <form onSubmit={addTeam} className="flex max-w-xl flex-col gap-1">
          <label htmlFor="new-team-name" className={LABEL_CLASS}>
            New team
          </label>
          <div className="flex gap-2">
            <input
              id="new-team-name"
              className={INPUT_CLASS}
              maxLength={EVENT_LIMITS.teamName}
              placeholder="Team name"
              value={name}
              disabled={atLimit}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <Button type="submit" disabled={!name.trim() || atLimit}>
              <Plus className="size-4" aria-hidden="true" />
              Add team
            </Button>
          </div>
        </form>
      )}

      {teams.length === 0 ? (
        <p className="text-muted-foreground text-sm">No teams yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              teamSize={teamSize}
              presets={presets}
              {...(editor ? { editor } : {})}
              onDelete={() => {
                setPendingDelete(team);
              }}
            />
          ))}
        </div>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              {pendingEntries > 0
                ? `This also deletes their ${String(pendingEntries)} logged ${pendingEntries === 1 ? "raid" : "raids"} and any adjustments. It can't be undone.`
                : "They haven't logged any raids yet."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDelete(null);
              }}
            >
              Keep team
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete && editor) editor.deleteTeam(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Remove team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
