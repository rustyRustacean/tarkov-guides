"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { toast } from "@/shared/ui/toast/toast-store";

import { useMapSessionStore } from "../../session/session-store";
import { useMapsSession } from "../../session/use-maps-session";
import { useSessionInactivityClose } from "../../session/use-session-inactivity-close";
import { useSessionUrlParam } from "../../session/use-session-url-param";

import { ControlRequestPrompt } from "./ControlRequestPrompt";
import { SessionEntryDialog } from "./SessionEntryDialog";
import { SessionStatusPill } from "./SessionStatusPill";

/**
 * The Maps page's single entry point for collaborative sessions - renders
 * the "Collaborate" button/dialog when no session is active, or the
 * participant status pill once one is. Also owns the invite-link auto-open
 * (`useSessionUrlParam`) and the host-side control-request prompt. Requires
 * a `Suspense` boundary around it (`useSessionUrlParam`'s `useSearchParams`
 * dependency) - see `MapScreenLayout.tsx`.
 */
export function SessionControls() {
  const activeSession = useMapSessionStore((state) => state.activeSession);
  const clearActiveSession = useMapSessionStore((state) => state.clearActiveSession);
  const { pendingJoinCode, clearPendingJoinCode } = useSessionUrlParam();
  const session = useMapsSession();

  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleEnd(): Promise<void> {
    if (!activeSession) return;
    try {
      await fetch("/api/maps-session/end", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: activeSession.code, participantId: session.selfId }),
      });
    } finally {
      clearActiveSession();
    }
  }

  function handleLeave(): void {
    clearActiveSession();
  }

  // Auto-ends an idle session after an hour with no shared activity - only
  // the host's client does this, since only the host's participantId can
  // actually succeed against `/api/maps-session/end` (that route's own
  // host-only check). Guests just ride along until the room disappears out
  // from under them, same as if the host had clicked "End session" manually.
  useSessionInactivityClose(activeSession !== null && session.isHost, () => {
    toast({ message: "Session ended after an hour of inactivity." });
    void handleEnd();
  });

  if (activeSession) {
    return (
      <>
        <SessionStatusPill
          code={activeSession.code}
          isHost={session.isHost}
          isController={session.isController}
          participants={session.participants}
          onRequestControl={session.requestControl}
          onReleaseControl={session.releaseControl}
          onLeave={handleLeave}
          onEnd={() => void handleEnd()}
        />
        <ControlRequestPrompt
          request={session.incomingControlRequest}
          onRespond={session.respondToControlRequest}
        />
      </>
    );
  }

  const dialogShouldOpen = dialogOpen || pendingJoinCode !== null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          setDialogOpen(true);
        }}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        Collaborate
      </Button>
      <SessionEntryDialog
        open={dialogShouldOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) clearPendingJoinCode();
        }}
        {...(pendingJoinCode ? { initialJoinCode: pendingJoinCode } : {})}
      />
    </>
  );
}
