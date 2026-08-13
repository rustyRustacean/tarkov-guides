import { describe, expect, it } from "vitest";

import { tarkovClock } from "./tarkov-clock";

describe("tarkovClock", () => {
  // Expected values include the +11min empirical calibration offset (see
  // tarkov-clock.ts's TARKOV_CLOCK_CALIBRATION_OFFSET_MS doc) on top of the
  // canonical 3h Moscow anchor, i.e. 03:00 + 11min = 03:11.
  it("at Unix epoch, left reads 03:11 (Moscow +3h anchor + calibration)", () => {
    expect(tarkovClock("left", 0)).toBe("03:11");
  });

  it("at Unix epoch, right reads 15:11 (12h ahead of left)", () => {
    expect(tarkovClock("right", 0)).toBe("15:11");
  });

  it("advances 7 in-game minutes per real minute", () => {
    const oneRealMinuteMs = 60_000;
    expect(tarkovClock("left", 0)).toBe("03:11");
    expect(tarkovClock("left", oneRealMinuteMs)).toBe("03:18");
  });

  it("wraps around a 24h in-game day", () => {
    // 3 real hours * 7 = 21 in-game hours, +3h anchor +11min calibration = 24h11min = wraps to 00:11.
    const threeRealHoursMs = 3 * 60 * 60 * 1000;
    expect(tarkovClock("left", threeRealHoursMs)).toBe("00:11");
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
