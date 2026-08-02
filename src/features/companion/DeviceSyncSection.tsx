"use client";

import { Check, Copy, MonitorSmartphone, RefreshCw } from "lucide-react";
import { useState } from "react";

import { generateSessionCode, normalizeSessionCode } from "@/features/maps/lib/session-code";
import { Button } from "@/shared/ui/button/Button";

import { getDeviceId, useDeviceSyncStore } from "./device-sync-store";

type Pane = "idle" | "hosting" | "joining";

/**
 * The "Sync my devices" pairing controls, shown inside the companion panel.
 *
 * Two roles, one code: the gaming PC starts sharing (generating a memorable
 * code), and every other device enters that code once to mirror its progress.
 * Nothing here is an account - the code is the only key, matching the
 * collaborative map sessions' existing no-account model.
 */
export function DeviceSyncSection() {
  const settings = useDeviceSyncStore((state) => state.settings);
  const error = useDeviceSyncStore((state) => state.error);
  const start = useDeviceSyncStore((state) => state.start);
  const stop = useDeviceSyncStore((state) => state.stop);
  const setError = useDeviceSyncStore((state) => state.setError);

  const [pane, setPane] = useState<Pane>("idle");
  const [draftCode, setDraftCode] = useState(() => generateSessionCode());
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function attempt(mode: "host" | "join", code: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/device-sync/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, code, deviceId: getDeviceId() }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const raw =
          payload !== null && typeof payload === "object" && "reason" in payload
            ? (payload as { reason?: unknown }).reason
            : undefined;
        const reason = typeof raw === "string" ? raw : "";
        setError(reason || "Could not start sync - try again.");
        return;
      }
      start(mode, code);
      setPane("idle");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Paired: show the active state ----
  if (settings) {
    const isHost = settings.role === "host";
    return (
      <section className="border-border bg-popover flex flex-col gap-2 rounded-md border p-3">
        <header className="flex items-center gap-2 text-sm font-medium">
          <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
          {isHost ? "Sharing with your devices" : "Mirroring your PC"}
          <span className="bg-status-teal ml-auto h-2 w-2 rounded-full" aria-hidden="true" />
        </header>

        <div className="flex items-center gap-2">
          <code className="border-border bg-card flex-1 rounded border px-2 py-1 font-mono text-sm">
            {settings.code}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Copy code"
            onClick={() => {
              void navigator.clipboard.writeText(settings.code);
              setCopied(true);
              window.setTimeout(() => {
                setCopied(false);
              }, 1500);
            }}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          {isHost
            ? "Enter this code on your phone, tablet, or another PC to see this progress there."
            : "This device follows the PC that owns this code."}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => {
            stop();
          }}
        >
          Turn off sync
        </Button>
      </section>
    );
  }

  // ---- Not paired: choose a role ----
  return (
    <section className="border-border bg-popover flex flex-col gap-2 rounded-md border p-3">
      <header className="flex items-center gap-2 text-sm font-medium">
        <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
        Sync my devices
      </header>

      {pane === "idle" && (
        <>
          <p className="text-muted-foreground text-xs">
            See this profile&apos;s progress on your phone, tablet, or another PC. No account - just
            a code.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setPane("hosting");
              }}
            >
              Share from this PC
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPane("joining");
              }}
            >
              Connect to my PC
            </Button>
          </div>
        </>
      )}

      {pane === "hosting" && (
        <>
          <p className="text-muted-foreground text-xs">
            Your devices will use this code. Keep it private.
          </p>
          <div className="flex items-center gap-2">
            <code className="border-border bg-card flex-1 rounded border px-2 py-1 font-mono text-sm">
              {draftCode}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="New code"
              onClick={() => {
                setDraftCode(generateSessionCode());
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => {
                void attempt("host", draftCode);
              }}
            >
              {busy ? "Starting..." : "Start sharing"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPane("idle");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}

      {pane === "joining" && (
        <>
          <label htmlFor="device-sync-code" className="text-muted-foreground text-xs">
            Enter the code shown on your gaming PC.
          </label>
          <input
            id="device-sync-code"
            value={joinCode}
            onChange={(event) => {
              setJoinCode(normalizeSessionCode(event.target.value));
            }}
            placeholder="silent-scav-42"
            className="border-border bg-card focus-visible:ring-ring rounded border px-2 py-1 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || joinCode.length === 0}
              onClick={() => {
                void attempt("join", joinCode);
              }}
            >
              {busy ? "Connecting..." : "Connect"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPane("idle");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-status-red text-xs">{error}</p>}
    </section>
  );
}
