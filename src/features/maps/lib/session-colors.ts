/**
 * Distinct, readable colors for color-coding session participants (each
 * person's drawn strokes, their marker on the map, their row in a future
 * participants panel).
 *
 * Assigned by JOIN SLOT, not by identity hash: slot 0 is always the host and
 * always the first color, the next person to join is always the second, and
 * so on. Everyone in the room resolves the same person to the same color,
 * because the slot is handed out once by the token route and baked into that
 * participant's Liveblocks `userInfo`, so "the blue one" means the same
 * player to every viewer, which is the whole point of a shared color. A
 * hash-based assignment (this file's previous approach) couldn't guarantee
 * that: two participant ids could hash to the same palette index, putting
 * two different people in identical colors.
 *
 * Not the same list as `annotations.ts`'s `DRAW_COLOR_PRESETS` (those are a
 * user's own stroke-color choices; this is an identity color assigned TO a
 * person, never picked by them).
 */
export const SESSION_PARTICIPANT_COLORS: readonly string[] = [
  "#ef4444", // 1 - host
  "#3b82f6", // 2
  "#22c55e", // 3
  "#eab308", // 4
  "#a855f7", // 5
  "#f97316", // 6
];

/**
 * How many people can be in one session. The palette above defines the cap:
 * a seventh participant would have to reuse a color, and two identically
 * colored markers on a map are worse than being told the room is full.
 */
export const MAX_SESSION_PARTICIPANTS = SESSION_PARTICIPANT_COLORS.length;

/**
 * The color for a join slot (0-based; 0 is the host). Out-of-range slots fall
 * back to the first color rather than throwing - the token route already
 * refuses to hand out a slot beyond the cap, so this is only a type-level
 * safety net.
 */
export function colorForSlot(slot: number): string {
  const index = Number.isInteger(slot) && slot >= 0 ? slot % SESSION_PARTICIPANT_COLORS.length : 0;
  return SESSION_PARTICIPANT_COLORS[index] ?? "#ef4444";
}

/**
 * Which slot a participant occupies in a room's roster, and the roster to
 * persist afterwards. Pure so the whole assignment policy is testable without
 * a Liveblocks round trip.
 *
 * Rules, in order:
 * 1. Already in the roster - keep that slot. A reconnect (refresh, second
 *    tab, dropped wifi) must never change someone's color mid-session.
 * 2. First empty slot.
 * 3. First slot whose occupant is no longer connected - reclaimed, so a
 *    session that has churned through people doesn't stay full forever.
 *    Existing occupants are never reordered, because shifting the roster
 *    would silently recolor everyone still in the room.
 * 4. Otherwise the room is full.
 *
 * The host is always slot 0: they create the room and are its first entry.
 */
export function assignParticipantSlot(
  roster: readonly string[],
  participantId: string,
  activeParticipantIds: readonly string[],
): { slot: number; roster: string[] } | { slot: null; roster: readonly string[] } {
  const next = Array.from({ length: MAX_SESSION_PARTICIPANTS }, (_, i) => roster[i] ?? "");

  const existing = next.indexOf(participantId);
  if (existing !== -1) return { slot: existing, roster: next };

  const empty = next.indexOf("");
  if (empty !== -1) {
    next[empty] = participantId;
    return { slot: empty, roster: next };
  }

  const stale = next.findIndex((id) => id !== "" && !activeParticipantIds.includes(id));
  if (stale !== -1) {
    next[stale] = participantId;
    return { slot: stale, roster: next };
  }

  return { slot: null, roster: next };
}
