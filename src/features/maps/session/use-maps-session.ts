"use client";

import { useEffect, useRef, useState } from "react";

import { nextControllerId, requestControlMode } from "../lib/session-control";

import {
  useBroadcastEvent,
  useEventListener,
  useMutation,
  useOthers,
  useSelf,
  useStorage,
} from "./liveblocks-config";
import { useMapSessionStore } from "./session-store";

import type { SessionView } from "./liveblocks-config";

const CONTROL_REQUEST_TIMEOUT_MS = 20_000;

export interface SessionParticipant {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
}

export interface IncomingControlRequest {
  fromId: string;
  fromName: string;
}

export interface UseMapsSessionResult {
  /** Whether a session is currently active at all - every other field is meaningless (defaulted) when this is `false`. */
  active: boolean;
  selfId: string | null;
  isHost: boolean;
  isController: boolean;
  hostId: string | null;
  controllerId: string | null;
  participants: readonly SessionParticipant[];
  view: SessionView | null;
  /** Sets the shared view - callers (`MapViewer`) are expected to only call this while `isController` is true. */
  setView: (view: SessionView) => void;
  /** Sends a "request control" ask - resolves instantly (self-granted) if the host isn't currently present, otherwise prompts the host. */
  requestControl: () => void;
  /** Hands control back to the host directly. */
  releaseControl: () => void;
  /** Host-only: a pending request from a guest awaiting accept/deny, or `null`. */
  incomingControlRequest: IncomingControlRequest | null;
  respondToControlRequest: (granted: boolean) => void;
}

/**
 * The primary hook for collaborative map session state - assembles
 * Liveblocks' presence/storage/events into one ergonomic shape, and owns the
 * control-handoff mechanics (request/grant/deny, host-always-reclaims,
 * orphaned-controller recovery) described in the session feature's plan.
 * Safe to call from anywhere inside `MapSessionRoomProvider` regardless of
 * whether a session is actually active (see that component's doc comment).
 */
export function useMapsSession(): UseMapsSessionResult {
  const activeSession = useMapSessionStore((state) => state.activeSession);
  const self = useSelf();
  const others = useOthers();
  // Cast back to each field's real type - `SessionStorage`'s index signature
  // (required for Liveblocks' own `S extends LsonObject` constraint, see its
  // doc comment in `liveblocks-config.ts`) widens `useStorage`'s selector
  // return type into one broad `Json` union; this app fully controls what's
  // ever written to these fields, so the precise type is safe to restore here.
  const hostId = useStorage((root) => root.hostId) as string | null;
  const controllerId = useStorage((root) => root.controllerId) as string | null;
  const view = useStorage((root) => root.view) as SessionView | null;
  const broadcast = useBroadcastEvent();

  const [incomingControlRequest, setIncomingControlRequest] =
    useState<IncomingControlRequest | null>(null);
  const denyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setControllerId = useMutation(({ storage }, next: string) => {
    storage.set("controllerId", next);
  }, []);

  const setView = useMutation(({ storage, self: mutationSelf }, next: SessionView) => {
    storage.set("view", next);
    // The host always reclaims control just by navigating themselves - no
    // separate confirmation needed, matching a "presenter can always take
    // back the reins" model.
    const currentHostId = storage.get("hostId");
    if (mutationSelf.id === currentHostId && storage.get("controllerId") !== currentHostId) {
      storage.set("controllerId", currentHostId);
    }
  }, []);

  const reconcileController = useMutation(
    ({ storage, self: mutationSelf, others: mutationOthers }) => {
      const participantIds = [mutationSelf.id, ...mutationOthers.map((other) => other.id)];
      const currentHostId = storage.get("hostId");
      const currentControllerId = storage.get("controllerId");
      const next = nextControllerId(currentHostId, currentControllerId, participantIds);
      if (next !== currentControllerId) storage.set("controllerId", next);
    },
    [],
  );

  const othersKey = others
    .map((other) => other.id)
    .sort()
    .join(",");
  useEffect(() => {
    // `hostId !== null` (not just `self`/`activeSession`) is the load-bearing
    // guard here - `self` becomes non-null as soon as the connection is
    // authenticated, which can happen before Storage has finished syncing
    // down from the server. Calling a `useMutation` before that throws
    // ("This mutation cannot be used until storage has been loaded"),
    // confirmed via a real connection during manual testing - `useStorage`
    // returning `null` is Liveblocks' own "not loaded yet" signal.
    if (!activeSession || !self || hostId === null) return;
    reconcileController();
    // `othersKey` is the intentional dependency (not `others` itself, which
    // is a new array reference every render) - refires only when who's
    // actually present changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, self?.id, hostId, othersKey, reconcileController]);

  useEventListener(({ event, user }) => {
    if (event.type === "request-control") {
      if (self?.info.isHost && user) {
        if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
        setIncomingControlRequest({ fromId: user.id, fromName: user.info.name });
        denyTimerRef.current = setTimeout(() => {
          setIncomingControlRequest(null);
          broadcast({ type: "control-denied" });
        }, CONTROL_REQUEST_TIMEOUT_MS);
      }
    }
  });

  const participants: SessionParticipant[] = self
    ? [self, ...others].map((user) => ({
        id: user.id,
        name: user.info.name,
        color: user.info.color,
        isHost: user.info.isHost,
      }))
    : [];

  function requestControl(): void {
    if (!self || !hostId) return;
    const participantIds = [self.id, ...others.map((other) => other.id)];
    if (requestControlMode(hostId, participantIds) === "claim-instantly") {
      setControllerId(self.id);
    } else {
      broadcast({ type: "request-control" });
    }
  }

  function releaseControl(): void {
    if (hostId) setControllerId(hostId);
  }

  function respondToControlRequest(granted: boolean): void {
    if (!incomingControlRequest) return;
    if (denyTimerRef.current) {
      clearTimeout(denyTimerRef.current);
      denyTimerRef.current = null;
    }
    if (granted) setControllerId(incomingControlRequest.fromId);
    broadcast({ type: granted ? "control-granted" : "control-denied" });
    setIncomingControlRequest(null);
  }

  return {
    active: activeSession !== null,
    selfId: self?.id ?? null,
    isHost: self?.info.isHost ?? false,
    isController: self !== null && self.id === controllerId,
    hostId: hostId ?? null,
    controllerId: controllerId ?? null,
    participants,
    view: view ?? null,
    setView,
    requestControl,
    releaseControl,
    incomingControlRequest,
    respondToControlRequest,
  };
}
