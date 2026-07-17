import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveGameItem, resolveGameItems, type ResolvableGameItem } from "./resolve-game-item";

interface TestItem extends ResolvableGameItem {
  id: string;
}

const ledx: TestItem = { id: "1", shortName: "LEDX", name: "LEDX Skin Transilluminator" };
const gpu: TestItem = { id: "2", shortName: "GPU", name: "Graphics card" };
const items: readonly TestItem[] = [ledx, gpu];
const byShortName: Readonly<Record<string, TestItem>> = { ledx, gpu };

describe("resolveGameItem", () => {
  it("resolves via the shortName key first", () => {
    expect(resolveGameItem(items, byShortName, { short: "LEDX" })).toBe(ledx);
  });

  it("is case-insensitive on the short key", () => {
    expect(resolveGameItem(items, byShortName, { short: "lEdX" })).toBe(ledx);
  });

  it("falls back to a nameLike substring match when the short key misses", () => {
    expect(resolveGameItem(items, byShortName, { short: "nope", nameLike: "graphics" })).toBe(gpu);
  });

  it("falls back to nameLike when short is entirely omitted", () => {
    expect(resolveGameItem(items, byShortName, { nameLike: "transilluminator" })).toBe(ledx);
  });

  it("requires an exact name match when nameExact is set", () => {
    expect(
      resolveGameItem(items, byShortName, { nameLike: "Graphics card", nameExact: true }),
    ).toBe(gpu);
    expect(
      resolveGameItem(items, byShortName, { nameLike: "Graphics", nameExact: true }),
    ).toBeUndefined();
  });

  it("returns undefined on a total miss", () => {
    expect(
      resolveGameItem(items, byShortName, { short: "nope", nameLike: "nothing-like-this" }),
    ).toBeUndefined();
  });

  it("returns undefined when neither short nor nameLike is provided", () => {
    expect(resolveGameItem(items, byShortName, {})).toBeUndefined();
  });
});

describe("resolveGameItems", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("resolves every matching spec and silently drops unresolved ones", () => {
    const result = resolveGameItems(
      [{ short: "LEDX" }, { short: "nope" }, { nameLike: "graphics" }],
      items,
      byShortName,
    );
    expect(result).toEqual([ledx, gpu]);
  });

  it("warns in development when a spec is unresolved, and does not warn in production", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.stubEnv("NODE_ENV", "development");
    resolveGameItems([{ short: "nope" }], items, byShortName);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    resolveGameItems([{ short: "nope" }], items, byShortName);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
