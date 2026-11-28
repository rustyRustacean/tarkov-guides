import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configuredSecret,
  generateSecretKey,
  hashSecretKey,
  hmacHex,
  isHexDigest,
  secretKeyMatches,
} from "./secrets";

const LONG = "s".repeat(32);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("keys and hashes", () => {
  it("hands out 43-character base64url keys, never the same twice", () => {
    const key = generateSecretKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSecretKey()).not.toBe(key);
  });

  it("matches a key only against its own hash", () => {
    const key = generateSecretKey();
    expect(isHexDigest(hashSecretKey(key))).toBe(true);
    expect(secretKeyMatches(key, hashSecretKey(key))).toBe(true);
    expect(secretKeyMatches(`${key}x`, hashSecretKey(key))).toBe(false);
    expect(secretKeyMatches(key, "not a hash")).toBe(false);
    expect(secretKeyMatches(key, undefined)).toBe(false);
  });
});

describe("configuredSecret", () => {
  it("returns a secret of at least 32 characters", () => {
    vi.stubEnv("TEST_SECRET", LONG);
    expect(configuredSecret("TEST_SECRET")).toBe(LONG);
  });

  it("treats an unset, empty or short secret as not configured", () => {
    expect(configuredSecret("TEST_SECRET_UNSET")).toBeNull();
    vi.stubEnv("TEST_SECRET", "");
    expect(configuredSecret("TEST_SECRET")).toBeNull();
    vi.stubEnv("TEST_SECRET", "s".repeat(31));
    expect(configuredSecret("TEST_SECRET")).toBeNull();
  });
});

describe("hmacHex", () => {
  it("is stable for one input and differs across inputs and secrets", () => {
    const a = hmacHex(LONG, "203.0.113.7");
    expect(isHexDigest(a)).toBe(true);
    expect(hmacHex(LONG, "203.0.113.7")).toBe(a);
    expect(hmacHex(LONG, "203.0.113.8")).not.toBe(a);
    expect(hmacHex("t".repeat(32), "203.0.113.7")).not.toBe(a);
    expect(a).not.toContain("203");
  });
});
