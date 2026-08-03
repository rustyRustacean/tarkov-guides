"use client";

import { Check, Copy, MonitorSmartphone, RefreshCw } from "lucide-react";
import { useState } from "react";

import { generateSessionCode, normalizeSessionCode } from "@/features/maps/lib/session-code";
import { Button } from "@/shared/ui/button/Button";

import { getDeviceId, useDeviceSyncStore } from "./device-sync-store";

type Pane = "idle" | "joining";

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
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Returns true on success. Never shows a code the server hasn't actually created. */
  async function attempt(mode: "host" | "join", code: string): Promise<boolean> {
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
        return false;
      }
      start(mode, code);
      setPane("idle");
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Host in one step: generate a code and create the room immediately, so the
   * code the user sees always exists on the server. (An earlier two-step
   * version showed a draft code before "Start sharing" was pressed - people
   * copied it and got "no device found", because the room wasn't created yet.)
   * Retries once on the rare generated-code collision.
   */
  async function startSharing() {
    const ok = await attempt("host", generateSessionCode());
    if (!ok) await attempt("host", generateSessionCode());
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
          {isHost && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="New code"
              disabled={busy}
              onClick={() => {
                void startSharing();
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {isHost ? (
          <p className="text-muted-foreground text-xs">
            Enter this code on your phone, tablet, or another PC to see this progress there.
          </p>
        ) : (
          <p className="border-status-blue bg-status-blue/10 text-foreground rounded border-l-2 px-2 py-1.5 text-xs">
            <span className="font-semibold">Viewing your PC&apos;s progress.</span> Nothing is saved
            on this device - your own progress is untouched and comes back when you turn sync off.
          </p>
        )}

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
              disabled={busy}
              onClick={() => {
                void startSharing();
              }}
            >
              {busy ? "Starting..." : "Share from this PC"}
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
