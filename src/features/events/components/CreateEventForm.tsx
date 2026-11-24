"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  PROFILE_MODE_LABELS,
  PROFILE_MODES,
  type ProfileMode,
} from "@/features/progress-tracker/types";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent } from "@/shared/ui/card/Card";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { createEvent } from "../lib/create-event";
import {
  DEFAULT_RAIDS_PER_MODE,
  MAX_RAIDS_PER_MODE,
  defaultSettings,
  emptyEventDocument,
  newId,
} from "../lib/defaults";
import { eventViewPath } from "../lib/event-code";
import { cleanText, EVENT_LIMITS } from "../lib/event-schema";
import { TEAM_SIZE_LABELS, TEAM_SIZES, type LeaderboardMode, type TeamSize } from "../types";

import { INPUT_CLASS, LABEL_CLASS } from "./event-ui";
import { NumberField } from "./NumberField";

import type { SubmitEvent } from "react";

/** Team names from a "one per line" box: cleaned, de-duplicated, capped. */
function parseTeamNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = cleanText(line, EVENT_LIMITS.teamName);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.slice(0, EVENT_LIMITS.teams);
}

/**
 * The new event form: the few choices that shape the scoreboard (modes,
 * team size, raid count, how modes are ranked), plus optional team names to
 * start with. Everything else (point values, columns, multipliers,
 * tiebreakers) starts from the defaults and is tuned on the event's Scoring
 * tab, where co-organizers can help.
 */
export function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [modes, setModes] = useState<ProfileMode[]>(["PVP"]);
  const [teamSize, setTeamSize] = useState<TeamSize>(2);
  const [raids, setRaids] = useState(DEFAULT_RAIDS_PER_MODE);
  const [leaderboard, setLeaderboard] = useState<LeaderboardMode>("combined");
  const [scoringPerMode, setScoringPerMode] = useState(false);
  const [teamText, setTeamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameId = useId();
  const raidsId = useId();
  const teamsId = useId();
  const multiMode = modes.length > 1;
  const teamNames = parseTeamNames(teamText);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = cleanText(name, EVENT_LIMITS.eventName);
    if (!clean) {
      setError("Give the event a name.");
      return;
    }
    const settings = defaultSettings(clean, modes, teamSize);
    for (const mode of modes) settings.raidsPerMode[mode] = raids;
    settings.leaderboard = multiMode ? leaderboard : "combined";
    settings.scoringPerMode = multiMode && scoringPerMode;
    const document = emptyEventDocument(settings);
    teamNames.forEach((teamName, order) => {
      const id = newId();
      document.teams[id] = { id, name: teamName, order, players: [] };
    });

    setSubmitting(true);
    setError(null);
    try {
      const code = await createEvent(document);
      router.push(eventViewPath(code));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't create the event.");
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardContent className="p-6">
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={nameId} className={LABEL_CLASS}>
              Event name
            </label>
            <input
              id={nameId}
              className={INPUT_CLASS}
              maxLength={EVENT_LIMITS.eventName}
              placeholder="e.g. Bolt and DMR Duo Cup"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              required
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={LABEL_CLASS}>Game modes</legend>
            <div className="flex flex-wrap gap-4">
              {PROFILE_MODES.map((mode) => {
                const checked = modes.includes(mode);
                return (
                  <label key={mode} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      disabled={checked && modes.length === 1}
                      onChange={() => {
                        setModes(
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

          {multiMode && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className={LABEL_CLASS} id="new-event-board">
                  Leaderboard
                </span>
                <SegmentedControl
                  aria-labelledby="new-event-board"
                  options={[
                    { value: "combined", label: "One combined board" },
                    { value: "separate", label: "One board per mode" },
                  ]}
                  value={leaderboard}
                  onChange={setLeaderboard}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={scoringPerMode}
                  onChange={() => {
                    setScoringPerMode(!scoringPerMode);
                  }}
                />
                Different points per mode (set them on the Scoring tab)
              </label>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS} id="new-event-team-size">
              Team size
            </span>
            <SegmentedControl
              aria-labelledby="new-event-team-size"
              options={TEAM_SIZES.map((size) => ({
                value: String(size),
                label: TEAM_SIZE_LABELS[size],
              }))}
              value={String(teamSize)}
              onChange={(value) => {
                setTeamSize(Number(value) as TeamSize);
              }}
            />
          </div>

          <div className="flex w-48 flex-col gap-1">
            <label htmlFor={raidsId} className={LABEL_CLASS}>
              Raids per team{multiMode ? ", each mode" : ""}
            </label>
            <NumberField
              id={raidsId}
              integer
              min={1}
              max={MAX_RAIDS_PER_MODE}
              value={raids}
              onChange={setRaids}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={teamsId} className={LABEL_CLASS}>
              Teams (optional, one per line)
            </label>
            <textarea
              id={teamsId}
              className={`${INPUT_CLASS} min-h-28`}
              value={teamText}
              onChange={(event) => {
                setTeamText(event.target.value);
              }}
            />
            <p className="text-muted-foreground text-xs">
              {teamNames.length > 0
                ? `${String(teamNames.length)} ${teamNames.length === 1 ? "team" : "teams"}. Player names go in on the Teams tab.`
                : "You can also add teams later."}
            </p>
          </div>

          <p className="text-muted-foreground text-sm">
            Scoring starts at PMC kill 5, dogtag 1, scav kill 1, rogue or guard kill 3, boss kill 7
            and 5 per player extracted. Change any of it, and add item bonuses, custom columns or
            penalties, on the event&apos;s Scoring tab.
          </p>

          {error && (
            <p role="alert" className="text-status-red text-sm">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? "Creating..." : "Create event"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
