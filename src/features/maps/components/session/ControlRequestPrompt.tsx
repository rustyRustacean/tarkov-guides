"use client";

import { Button } from "@/shared/ui/button/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import type { IncomingControlRequest } from "../../session/use-maps-session";

export interface ControlRequestPromptProps {
  request: IncomingControlRequest | null;
  onRespond: (granted: boolean) => void;
}

/**
 * Host-side blocking prompt for a guest's "request control" ask. A real
 * `Dialog`, not a toast, since handing over map-navigation control is easy
 * to miss or dismiss accidentally in a passing notification. Auto-denies
 * after a timeout if left unanswered (`use-maps-session.ts`'s own timer);
 * this component just renders whatever request is currently pending, if
 * any.
 */
export function ControlRequestPrompt({ request, onRespond }: ControlRequestPromptProps) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onRespond(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Control request</DialogTitle>
          <DialogDescription>
            {request?.fromName ?? "Someone"} wants to drive the shared map view.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onRespond(false);
            }}
          >
            Deny
          </Button>
          <Button
            type="button"
            onClick={() => {
              onRespond(true);
            }}
          >
            Grant control
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
