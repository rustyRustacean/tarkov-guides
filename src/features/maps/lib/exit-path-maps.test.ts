import { describe, expect, it } from "vitest";

import { exitPathAvailable } from "./exit-path-maps";

describe("exitPathAvailable", () => {
  it("is off for Terminal and Icebreaker only", () => {
    expect(exitPathAvailable("terminal")).toBe(false);
    expect(exitPathAvailable("icebreaker")).toBe(false);
    for (const name of ["customs", "shoreline", "woods", "factory", "the-lab"]) {
      expect(exitPathAvailable(name)).toBe(true);
    }
  });
});
