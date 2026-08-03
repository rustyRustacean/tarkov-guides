import { afterEach, describe, expect, it } from "vitest";

import { isPersistenceSuspended, setPersistenceSuspended } from "./suspend";

afterEach(() => {
  setPersistenceSuspended(false);
});

describe("persistence suspension", () => {
  it("is off by default", () => {
    expect(isPersistenceSuspended()).toBe(false);
  });

  it("suspends and resumes", () => {
    setPersistenceSuspended(true);
    expect(isPersistenceSuspended()).toBe(true);
    setPersistenceSuspended(false);
    expect(isPersistenceSuspended()).toBe(false);
  });
});
