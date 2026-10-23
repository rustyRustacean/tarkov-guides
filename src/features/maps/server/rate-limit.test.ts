import { beforeEach, describe, expect, it } from "vitest";

import { MAX_REQUESTS_PER_MINUTE } from "../lib/route-limits";

import { resetRateLimit, retryAfterSeconds } from "./rate-limit";

beforeEach(resetRateLimit);

describe("retryAfterSeconds", () => {
  it("lets a client make the allowed number of requests, then makes it wait", () => {
    const t = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i += 1) {
      expect(retryAfterSeconds("a", t + i)).toBe(0);
    }
    expect(retryAfterSeconds("a", t + 1000)).toBeGreaterThan(0);
  });

  it("does not count one client's requests against another", () => {
    const t = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i += 1) retryAfterSeconds("a", t);
    expect(retryAfterSeconds("b", t)).toBe(0);
  });

  it("lets a client back in once the minute has passed", () => {
    const t = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i += 1) retryAfterSeconds("a", t);
    expect(retryAfterSeconds("a", t + 61_000)).toBe(0);
  });
});
