import { describe, expect, it } from "vitest";

import { checkRateLimit, clientIpFrom } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows calls up to the max within the window", () => {
    const key = "test-key-a";
    expect(checkRateLimit(key, 3, 1000, 0)).toBe(true);
    expect(checkRateLimit(key, 3, 1000, 100)).toBe(true);
    expect(checkRateLimit(key, 3, 1000, 200)).toBe(true);
  });

  it("blocks once the max is exceeded within the window", () => {
    const key = "test-key-b";
    expect(checkRateLimit(key, 2, 1000, 0)).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 100)).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 200)).toBe(false);
  });

  it("resets the count once the window elapses", () => {
    const key = "test-key-c";
    expect(checkRateLimit(key, 1, 1000, 0)).toBe(true);
    expect(checkRateLimit(key, 1, 1000, 500)).toBe(false);
    expect(checkRateLimit(key, 1, 1000, 1000)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    expect(checkRateLimit("test-key-d1", 1, 1000, 0)).toBe(true);
    expect(checkRateLimit("test-key-d2", 1, 1000, 0)).toBe(true);
  });
});

describe("clientIpFrom", () => {
  it("reads the first entry of x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIpFrom(request)).toBe("1.2.3.4");
  });

  it("falls back to a constant when the header is absent", () => {
    const request = new Request("https://example.com");
    expect(clientIpFrom(request)).toBe("unknown");
  });
});
