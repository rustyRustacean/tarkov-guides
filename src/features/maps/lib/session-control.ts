/**
 * Pure control-handoff transition logic for collaborative map sessions:
 * "who is currently allowed to drive the shared map view." Kept separate
 * from the Liveblocks `useMutation` wiring (`session/use-maps-session.ts`) so
 * the branching (host present vs. absent, orphaned-controller recovery) is
 * unit-testable without a real room connection, matching this feature's
 * "pure logic in `lib/`, thin hook wiring" convention (see `annotations.ts`).
 */

/**
 * Recomputes who should hold navigation control given who's currently in the
 * room. If the current controller has disconnected, control reverts to the
 * host (if the host is present); otherwise it's left unchanged. Callers
 * should skip the Storage write entirely when the return value is
 * reference-equal to the input `controllerId`: every client runs this
 * independently on every presence change, so redundant no-op writes from
 * multiple clients are avoided by simply not writing when nothing changed.
 */
export function nextControllerId(
  hostId: string,
  controllerId: string,
  participantIds: readonly string[],
): string {
  if (participantIds.includes(controllerId)) return controllerId;
  if (participantIds.includes(hostId)) return hostId;
  // Neither the current controller nor the host is present (e.g. everyone
  // disconnected momentarily). Nothing sensible to fall back to yet, leave
  // as-is until someone (re)joins.
  return controllerId;
}

export type RequestControlMode = "ask-host" | "claim-instantly";

/**
 * Whether clicking "Request control" should prompt the host for
 * confirmation (the normal path) or let the requester claim control
 * immediately. If the host isn't currently present in the room, there's no
 * one to confirm the request, so an instant claim is what keeps a session
 * from getting permanently stuck driving nowhere.
 */
export function requestControlMode(
  hostId: string,
  participantIds: readonly string[],
): RequestControlMode {
  return participantIds.includes(hostId) ? "ask-host" : "claim-instantly";
}
