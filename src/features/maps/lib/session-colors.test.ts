import { describe, expect, it } from "vitest";

import { colorForParticipant, SESSION_PARTICIPANT_COLORS } from "./session-colors";

describe("colorForParticipant", () => {
  it("is deterministic for the same id", () => {
    const id = "participant-abc-123";
    expect(colorForParticipant(id)).toBe(colorForParticipant(id));
  });

  it("always returns a color from the palette", () => {
    for (const id of ["a", "b", "c", "participant-xyz", ""]) {
      expect(SESSION_PARTICIPANT_COLORS).toContain(colorForParticipant(id));
    }
  });

  it("spreads different ids across more than one color", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `participant-${String(i)}`);
    const colors = new Set(ids.map(colorForParticipant));
    expect(colors.size).toBeGreaterThan(1);
  });
});
