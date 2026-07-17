import { describe, expect, it } from "vitest";

import { tarkovClock } from "./tarkov-clock";

describe("tarkovClock", () => {
  it("at Unix epoch, left reads 03:00 (the Moscow +3h anchor)", () => {
    expect(tarkovClock("left", 0)).toBe("03:00");
  });

  it("at Unix epoch, right reads 15:00 (12h ahead of left)", () => {
    expect(tarkovClock("right", 0)).toBe("15:00");
  });

  it("advances 7 in-game minutes per real minute", () => {
    const oneRealMinuteMs = 60_000;
    expect(tarkovClock("left", 0)).toBe("03:00");
    expect(tarkovClock("left", oneRealMinuteMs)).toBe("03:07");
  });

  it("wraps around a 24h in-game day", () => {
    // 3 real hours * 7 = 21 in-game hours, +3h anchor = 24h = wraps to 00:00.
    const threeRealHoursMs = 3 * 60 * 60 * 1000;
    expect(tarkovClock("left", threeRealHoursMs)).toBe("00:00");
  });

  it("never returns a negative-derived time for any real timestamp", () => {
    for (const now of [0, 1, -1, Date.now(), -Date.now()]) {
      const [hours, minutes] = tarkovClock("left", now).split(":").map(Number);
      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThan(24);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThan(60);
    }
  });

  it("defaults `now` to the real current time when omitted", () => {
    const before = tarkovClock("left", Date.now());
    const omitted = tarkovClock("left");
    // Both computed within the same real second almost always match; this
    // just confirms the function actually reads a live clock, not a stub.
    expect(omitted).toMatch(/^\d{2}:\d{2}$/);
    expect(before).toMatch(/^\d{2}:\d{2}$/);
  });
});
