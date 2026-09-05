import { afterEach, describe, expect, it, vi } from "vitest";

import { findAccountId, primePlayerIndexCache, resetPlayerIndexCache } from "./player-index";

// A miniature of the real index: `{"<accountId>":"<nickname>", ...}`.
const INDEX =
  '{"15":"Buhaus","675149":"ladiesman257","949131":"BearNakedLadies","42":"xX_Bob-9_Xx"}';

afterEach(() => {
  resetPlayerIndexCache();
  vi.restoreAllMocks();
});

describe("findAccountId", () => {
  it("finds an exact nickname", async () => {
    primePlayerIndexCache("pvp", INDEX);
    await expect(findAccountId("ladiesman257", "pvp")).resolves.toBe("675149");
  });

  it("matches case-insensitively, since OCR has no reliable sense of case", async () => {
    primePlayerIndexCache("pvp", INDEX);
    await expect(findAccountId("BUHAUS", "pvp")).resolves.toBe("15");
  });

  it("returns null for a name that isn't in the index", async () => {
    primePlayerIndexCache("pvp", INDEX);
    await expect(findAccountId("ixLadies", "pvp")).resolves.toBeNull();
  });

  it("does not match a partial nickname", async () => {
    primePlayerIndexCache("pvp", INDEX);
    // "Buha" must not resolve to Buhaus - the wrong player's card is worse
    // than no card.
    await expect(findAccountId("Buha", "pvp")).resolves.toBeNull();
    await expect(findAccountId("adies", "pvp")).resolves.toBeNull();
  });

  it("treats regex metacharacters in a nickname as literal text", async () => {
    primePlayerIndexCache("pvp", INDEX);
    // OCR output is untrusted; an unescaped '.' would match any character.
    await expect(findAccountId("Buhau.", "pvp")).resolves.toBeNull();
    await expect(findAccountId("xX_Bob-9_Xx", "pvp")).resolves.toBe("42");
  });

  it("ignores an empty name without touching the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(findAccountId("   ", "pvp")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps PvP and PvE indexes apart", async () => {
    primePlayerIndexCache("pvp", INDEX);
    primePlayerIndexCache("pve", '{"777":"PveOnlyGuy"}');
    await expect(findAccountId("PveOnlyGuy", "pve")).resolves.toBe("777");
    await expect(findAccountId("PveOnlyGuy", "pvp")).resolves.toBeNull();
  });

  it("downloads once and serves later lookups from cache", async () => {
    // A fresh Response per call: a body can only be read once, so a single
    // shared instance would fail the second fetch for the wrong reason.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response(INDEX, { status: 200 })));
    await expect(findAccountId("Buhaus", "pvp")).resolves.toBe("15");
    await expect(findAccountId("ladiesman257", "pvp")).resolves.toBe("675149");
    // The index is ~67 MB - fetching it per lookup would be ruinous.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent cold lookups into a single download", async () => {
    // A fresh Response per call: a body can only be read once, so a single
    // shared instance would fail the second fetch for the wrong reason.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response(INDEX, { status: 200 })));
    const [a, b, c] = await Promise.all([
      findAccountId("Buhaus", "pvp"),
      findAccountId("ladiesman257", "pvp"),
      findAccountId("BearNakedLadies", "pvp"),
    ]);
    expect([a, b, c]).toEqual(["15", "675149", "949131"]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("refetches once the cached copy is older than the TTL", async () => {
    // A fresh Response per call: a body can only be read once, so a single
    // shared instance would fail the second fetch for the wrong reason.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response(INDEX, { status: 200 })));
    const start = 1_000_000;
    await findAccountId("Buhaus", "pvp", start);
    await findAccountId("Buhaus", "pvp", start + 13 * 60 * 60 * 1000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("propagates an upstream failure rather than caching a bad index", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 503 }));
    await expect(findAccountId("Buhaus", "pvp")).rejects.toThrow("503");
  });
});
