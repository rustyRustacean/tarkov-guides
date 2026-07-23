"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { Button } from "@/shared/ui/button/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import {
  generateSessionCode,
  isValidCustomCode,
  normalizeSessionCode,
} from "../../lib/session-code";
import { submitSessionToken } from "../../session/join-session";

const inputClassName =
  "border-border bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

function useDefaultDisplayName(): string {
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  return profiles.find((profile) => profile.id === activeProfileId)?.name ?? "";
}

export interface SessionEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the Join tab with this code filled in - set when arriving via an invite link (`?session=CODE`). */
  initialJoinCode?: string;
}

/**
 * The "Collaborate" entry point - host a new session or join one via code,
 * word, or an invite link's pre-filled code. One dialog with two tabs
 * (rather than two separate dialog components) so both forms share the same
 * `Dialog` chrome and neither duplicates the other's layout.
 */
export function SessionEntryDialog({
  open,
  onOpenChange,
  initialJoinCode,
}: SessionEntryDialogProps) {
  const defaultDisplayName = useDefaultDisplayName();
  const [tab, setTab] = useState<"host" | "join">(initialJoinCode ? "join" : "host");

  // Jumps to the Join tab whenever a new invite-link code arrives (e.g. the
  // URL param resolves after this dialog is already mounted) - adjusting
  // state directly during render (React's own recommended pattern for
  // "reset/derive state when a prop changes") rather than via an effect,
  // since an effect would commit the initial render first and only correct
  // the tab a beat later, causing a visible flash of the wrong tab.
  const [prevInitialJoinCode, setPrevInitialJoinCode] = useState(initialJoinCode);
  if (initialJoinCode !== prevInitialJoinCode) {
    setPrevInitialJoinCode(initialJoinCode);
    if (initialJoinCode) setTab("join");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collaborate</DialogTitle>
          <DialogDescription>
            Host a shared session so others can follow along and draw on the map with you, or join
            one with a code.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as "host" | "join");
          }}
          className="mt-2"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="host">Host</TabsTrigger>
            <TabsTrigger value="join">Join</TabsTrigger>
          </TabsList>

          <TabsContent value="host">
            <HostForm
              defaultDisplayName={defaultDisplayName}
              onDone={() => {
                onOpenChange(false);
              }}
            />
          </TabsContent>
          <TabsContent value="join">
            <JoinForm
              defaultDisplayName={defaultDisplayName}
              initialCode={initialJoinCode ?? ""}
              onDone={() => {
                onOpenChange(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface HostFormProps {
  defaultDisplayName: string;
  onDone: () => void;
}

function HostForm({ defaultDisplayName, onDone }: HostFormProps) {
  const [useCustomWord, setUseCustomWord] = useState(false);
  const [autoCode, setAutoCode] = useState(() => generateSessionCode());
  const [customCode, setCustomCode] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = useCustomWord ? customCode : autoCode;
  const customValidation = useCustomWord ? isValidCustomCode(customCode) : null;
  const canSubmit =
    displayName.trim().length > 0 &&
    !submitting &&
    (!useCustomWord || customValidation?.valid === true);

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    const result = await submitSessionToken("host", normalizeSessionCode(code), displayName.trim());
    if (result.ok) {
      onDone();
    } else {
      setSubmitting(false);
      setError(result.reason ?? "Something went wrong - try again.");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          type="text"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
          maxLength={40}
          autoComplete="off"
          className={inputClassName}
          aria-label="Your name"
        />
      </label>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Join code</span>
        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={useCustomWord}
            onChange={(event) => {
              setUseCustomWord(event.target.checked);
            }}
          />
          Use my own word
        </label>
      </div>

      {useCustomWord ? (
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={customCode}
            onChange={(event) => {
              setCustomCode(event.target.value);
            }}
            placeholder="e.g. my-squad-42"
            autoComplete="off"
            className={inputClassName}
            aria-label="Custom join word"
          />
          {customCode.length > 0 && customValidation && !customValidation.valid && (
            <p className="text-destructive text-xs">{customValidation.reason}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="bg-muted flex-1 rounded-md px-3 py-1.5 text-sm">{autoCode}</code>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              setAutoCode(generateSessionCode());
            }}
            aria-label="Regenerate code"
            title="Regenerate code"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        type="button"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        className="mt-2"
      >
        {submitting ? "Starting…" : "Start Hosting"}
      </Button>
    </div>
  );
}

interface JoinFormProps {
  defaultDisplayName: string;
  initialCode: string;
  onDone: () => void;
}

function JoinForm({ defaultDisplayName, initialCode, onDone }: JoinFormProps) {
  const [code, setCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same "adjust state during render" pattern as the tab-switching logic
  // above, for the same reason - a newly-resolved invite-link code should
  // fill the input immediately, not one render late via an effect.
  const [prevInitialCode, setPrevInitialCode] = useState(initialCode);
  if (initialCode !== prevInitialCode) {
    setPrevInitialCode(initialCode);
    if (initialCode) setCode(initialCode);
  }

  const canSubmit = code.trim().length > 0 && displayName.trim().length > 0 && !submitting;

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    const result = await submitSessionToken("join", normalizeSessionCode(code), displayName.trim());
    if (result.ok) {
      onDone();
    } else {
      setSubmitting(false);
      setError(result.reason ?? "Something went wrong - try again.");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Join code
        <input
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          placeholder="e.g. silent-scav-42"
          autoComplete="off"
          className={inputClassName}
          aria-label="Join code"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          type="text"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
          maxLength={40}
          autoComplete="off"
          className={inputClassName}
          aria-label="Your name"
        />
      </label>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        type="button"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        className="mt-2"
      >
        {submitting ? "Joining…" : "Join"}
      </Button>
    </div>
  );
}
