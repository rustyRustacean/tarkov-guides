import { describe, expect, it, vi } from "vitest";

import { generateSessionCode, isValidCustomCode, normalizeSessionCode } from "./session-code";

describe("generateSessionCode", () => {
  it("produces a word-word-digits shape", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSessionCode()).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    }
  });

  it("is not deterministic across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateSessionCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("normalizeSessionCode", () => {
  it("lowercases and trims", () => {
    expect(normalizeSessionCode("  Silent-Scav-42  ")).toBe("silent-scav-42");
  });

  it("collapses whitespace runs into a single hyphen", () => {
    expect(normalizeSessionCode("silent   scav 42")).toBe("silent-scav-42");
  });

  it("strips characters outside [a-z0-9-]", () => {
    expect(normalizeSessionCode("silent_scav!42?")).toBe("silentscav42");
  });
});

describe("isValidCustomCode", () => {
  it("accepts a well-formed custom code", () => {
    expect(isValidCustomCode("my-custom-word")).toEqual({ valid: true });
  });

  it("rejects codes shorter than the minimum length", () => {
    expect(isValidCustomCode("ab").valid).toBe(false);
  });

  it("rejects codes longer than the maximum length", () => {
    expect(isValidCustomCode("a".repeat(40)).valid).toBe(false);
  });

  it("rejects disallowed characters", () => {
    expect(isValidCustomCode("my custom word!").valid).toBe(false);
  });

  it("rejects purely numeric codes", () => {
    expect(isValidCustomCode("123456").valid).toBe(false);
  });

  it("rejects denylisted words", () => {
    expect(isValidCustomCode("test").valid).toBe(false);
    expect(isValidCustomCode("session").valid).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isValidCustomCode("My-Custom-Word")).toEqual({ valid: true });
  });
});

// Guards against a future edit accidentally reintroducing Math.random-free
// determinism (e.g. a hardcoded word), which would defeat the "regenerate"
// button's whole purpose.
describe("generateSessionCode randomness plumbing", () => {
  it("actually consults Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    generateSessionCode();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
