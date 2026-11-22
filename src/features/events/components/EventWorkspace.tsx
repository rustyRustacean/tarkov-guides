"use client";

import { PROFILE_MODE_LABELS } from "@/features/progress-tracker/types";
import { Badge } from "@/shared/ui/badge/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { TEAM_SIZE_LABELS, type EventDocument } from "../types";

import { ActivityPanel } from "./ActivityPanel";
import { AdjustmentsPanel } from "./AdjustmentsPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { RaidLogPanel } from "./RaidLogPanel";
import { ScoringPanel } from "./ScoringPanel";
import { SharePanel } from "./SharePanel";
import { TeamsPanel } from "./TeamsPanel";

import type { EventEditor } from "../room/use-event-editor";
import type { ReactNode } from "react";

/** Editing capabilities, present only for someone in the event's room with its edit key. */
export interface WorkspaceEditing {
  editor: EventEditor;
  editKey: string;
}

/**
 * Everything about one event: a header with its modes and format, then
 * tabs. Viewers get the read-only tabs; editors also get Scoring, Activity
 * and Share. The same components render both, so what a viewer sees is
 * exactly what an editor sees minus the controls.
 */
export function EventWorkspace({
  doc,
  code,
  editing,
  status,
}: {
  doc: EventDocument;
  code: string;
  editing?: WorkspaceEditing;
  /** A line under the title: who's editing, or when the view last refreshed. */
  status: ReactNode;
}) {
  const { settings } = doc;
  const editor = editing?.editor;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold break-words">{settings.name}</h1>
        <div className="flex flex-wrap gap-2">
          {settings.modes.map((mode) => (
            <Badge key={mode} variant="outline">
              {PROFILE_MODE_LABELS[mode]}
            </Badge>
          ))}
          <Badge variant="outline">{TEAM_SIZE_LABELS[settings.teamSize]}</Badge>
          <Badge variant={editing ? "teal" : "secondary"}>
            {editing ? "Editing" : "View only"}
          </Badge>
        </div>
        <div className="text-muted-foreground text-sm">{status}</div>
      </header>

      <Tabs defaultValue="leaderboard">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="raids">Raid log</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
          {editing && (
            <>
              <TabsTrigger value="scoring">Scoring</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="share">Share</TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="leaderboard" className="pt-4">
          <LeaderboardPanel doc={doc} />
        </TabsContent>
        <TabsContent value="raids" className="pt-4">
          <RaidLogPanel doc={doc} {...(editor ? { editor } : {})} />
        </TabsContent>
        <TabsContent value="teams" className="pt-4">
          <TeamsPanel doc={doc} {...(editor ? { editor } : {})} />
        </TabsContent>
        <TabsContent value="adjustments" className="pt-4">
          <AdjustmentsPanel doc={doc} {...(editor ? { editor } : {})} />
        </TabsContent>
        {editing && (
          <>
            <TabsContent value="scoring" className="pt-4">
              <ScoringPanel doc={doc} editor={editing.editor} />
            </TabsContent>
            <TabsContent value="activity" className="pt-4">
              <ActivityPanel activity={doc.activity} />
            </TabsContent>
            <TabsContent value="share" className="pt-4">
              <SharePanel doc={doc} code={code} editKey={editing.editKey} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
