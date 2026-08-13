/**
 * Distinct, readable colors for color-coding session participants (e.g. each
 * person's drawn strokes, their row in `SessionParticipantsPanel`). A fixed
 * palette assigned deterministically by participant id, not the same list as
 * `annotations.ts`'s `DRAW_COLOR_PRESETS` (those are a user's own stroke-color
 * choices; this is an identity color assigned to a *person*, not chosen by them).
 */
export const SESSION_PARTICIPANT_COLORS: readonly string[] = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

/** A small, non-cryptographic string hash (djb2): only needs to spread ids evenly across the palette, not resist collisions adversarially. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Deterministically assigns a color to a participant id: same id always
 * yields the same color (stable across reconnects, since `participantId` is
 * itself stable, see `liveblocks-config.ts`), computed client-side so no
 * server round-trip is needed just to know a participant's own color.
 */
export function colorForParticipant(participantId: string): string {
  const index = hashString(participantId) % SESSION_PARTICIPANT_COLORS.length;
  // The `??` fallback is unreachable (the modulo above always stays in
  // range). `noUncheckedIndexedAccess` can't see that, so this just
  // satisfies the type checker without a non-null assertion.
  return SESSION_PARTICIPANT_COLORS[index] ?? "#ef4444";
}
