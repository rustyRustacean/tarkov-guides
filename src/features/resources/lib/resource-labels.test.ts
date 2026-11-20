import { describe, expect, it } from "vitest";

import { formatCheckedMonth, formatResourceModes } from "./resource-labels";

describe("formatCheckedMonth", () => {
  it("spells out the month", () => {
    expect(formatCheckedMonth("2026-11")).toBe("November 2026");
    expect(formatCheckedMonth("2027-01")).toBe("January 2027");
  });

  it("leaves anything that isn't YYYY-MM alone", () => {
    expect(formatCheckedMonth("2026-13")).toBe("2026-13");
    expect(formatCheckedMonth("soon")).toBe("soon");
  });
});

describe("formatResourceModes", () => {
  it("describes each shape", () => {
    expect(formatResourceModes("all")).toBe("Follows your game mode");
    expect(formatResourceModes(["PVP_SEASONAL"])).toBe("Seasonal only");
    expect(formatResourceModes(["PVP", "PVE"])).toBe("PvP and PvE");
    expect(formatResourceModes(["PVP", "PVE", "PVP_SEASONAL"])).toBe("PvP, PvE and Seasonal");
  });
});
