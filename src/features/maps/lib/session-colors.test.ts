import { describe, expect, it } from "vitest";

import {
  assignParticipantSlot,
  colorForSlot,
  MAX_SESSION_PARTICIPANTS,
  SESSION_PARTICIPANT_COLORS,
} from "./session-colors";

describe("colorForSlot", () => {
  it("gives every slot its own color, host first", () => {
    const colors = Array.from({ length: MAX_SESSION_PARTICIPANTS }, (_, i) => colorForSlot(i));
    expect(new Set(colors).size).toBe(MAX_SESSION_PARTICIPANTS);
    expect(colors[0]).toBe(SESSION_PARTICIPANT_COLORS[0]);
  });

  it("is a pure function of the slot, so every client resolves the same color", () => {
    expect(colorForSlot(3)).toBe(colorForSlot(3));
  });

  it("falls back to the first color for a nonsense slot", () => {
    expect(colorForSlot(-1)).toBe(SESSION_PARTICIPANT_COLORS[0]);
    expect(colorForSlot(1.5)).toBe(SESSION_PARTICIPANT_COLORS[0]);
  });
});

describe("assignParticipantSlot", () => {
  const active = (...ids: string[]) => ids;

  it("hands out slots in join order", () => {
    let roster: readonly string[] = [];
    const slots: (number | null)[] = [];
    for (const id of ["host", "b", "c", "d"]) {
      const result = assignParticipantSlot(roster, id, active());
      slots.push(result.slot);
      roster = result.roster;
    }
    expect(slots).toEqual([0, 1, 2, 3]);
  });

  it("keeps a returning participant's slot, so a refresh never recolors them", () => {
    const roster = ["host", "b", "c", "", "", ""];
    expect(assignParticipantSlot(roster, "b", active("host", "b", "c")).slot).toBe(1);
  });

  it("refuses a seventh person rather than reusing a color", () => {
    const roster = ["a", "b", "c", "d", "e", "f"];
    const result = assignParticipantSlot(roster, "g", active("a", "b", "c", "d", "e", "f"));
    expect(result.slot).toBeNull();
  });

  it("reclaims a departed participant's slot without moving anyone else", () => {
    const roster = ["a", "b", "c", "d", "e", "f"];
    // "c" has left; everyone else is still connected.
    const result = assignParticipantSlot(roster, "g", active("a", "b", "d", "e", "f"));
    expect(result.slot).toBe(2);
    expect(result.roster).toEqual(["a", "b", "g", "d", "e", "f"]);
  });

  it("never renumbers existing occupants when filling a gap", () => {
    const roster = ["host", "", "c", "", "", ""];
    const result = assignParticipantSlot(roster, "new", active("host", "c"));
    expect(result.slot).toBe(1);
    expect(result.roster[0]).toBe("host");
    expect(result.roster[2]).toBe("c");
  });

  it("pads a short or empty roster to the full slot count", () => {
    const result = assignParticipantSlot([], "host", active());
    expect(result.roster).toHaveLength(MAX_SESSION_PARTICIPANTS);
    expect(result.slot).toBe(0);
  });
});
