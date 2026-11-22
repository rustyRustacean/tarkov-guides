import { describe, expect, it } from "vitest";

import { isChromelessPath } from "./chromeless-routes";

describe("isChromelessPath", () => {
  it("matches only event overlay pages", () => {
    expect(isChromelessPath("/resources/events/abcdefghjk/overlay")).toBe(true);
    expect(isChromelessPath("/resources/events/abcdefghjk/overlay/")).toBe(true);
    expect(isChromelessPath("/resources/events/abcdefghjk")).toBe(false);
    expect(isChromelessPath("/resources/events")).toBe(false);
    expect(isChromelessPath("/maps")).toBe(false);
  });
});
