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
import { TEAM_SIZE_LABELS, type EventDocument, type Player, type Team } from "../types";

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
  editor,
  onDelete,
}: {
  team: Team;
  teamSize: number;
  editor?: EventEditor;
  onDelete: () => void;
}) {
  const players = rosterSlots(team.id, team.players, teamSize);

  if (!editor) {
    const names = team.players.map((player) => player.name).filter(Boolean);
    return (
      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <p className="font-semibold">{team.name}</p>
          <p className="text-muted-foreground text-sm">
            {names.length > 0 ? names.join(", ") : "No player names yet"}
          </p>
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
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((player, index) => (
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              teamSize={teamSize}
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
