import { describe, expect, it } from "vitest";

import { MODIFIER_SHARE_SLOTS } from "../data/seasonal-modifiers";

import {
  MAX_SHARE_HASH_LENGTH,
  picksFromHash,
  picksHash,
  type ShareScheme,
} from "./modifier-share-link";

const SEASON_2: ShareScheme = { season: 2, slots: MODIFIER_SHARE_SLOTS };
const SMALL: ShareScheme = { season: 2, slots: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] };
const RETIRED: ShareScheme = { season: 2, slots: ["a", null, "c"] };

describe("picksHash and picksFromHash", () => {
  it("packs picks into a short code", () => {
    const every = MODIFIER_SHARE_SLOTS.filter((id) => id !== null);
    expect(picksHash(SEASON_2, ["average", "no-flea-market"])).toBe("#s=2&p=AAAAEAAAIA");
    expect(picksHash(SEASON_2, every)).toBe("#s=2&p=_________w");
  });

  it("skips a retired slot both ways", () => {
    expect(picksHash(RETIRED, ["a", "c"])).toBe("#s=2&p=BQ");
    expect(picksFromHash("#s=2&p=Bw", RETIRED)).toEqual({ status: "picks", ids: ["a", "c"] });
  });

  // Pinned codes: if these change, every link already shared opens differently.
  it("reads published codes back to the same picks", () => {
    expect(picksFromHash("#s=2&p=AAAAEAAAIA", SEASON_2)).toEqual({
      status: "picks",
      ids: ["average", "no-flea-market"],
    });
    expect(picksFromHash("#s=2&p=AQBAAAAAgA", SEASON_2)).toEqual({
      status: "picks",
      ids: ["lockpicker", "sprinter", "unlucky"],
    });
  });

  it("round-trips picks in slot order, each once", () => {
    const hash = picksHash(SMALL, ["i", "b", "b", "e"]);

    expect(picksFromHash(hash, SMALL)).toEqual({ status: "picks", ids: ["b", "e", "i"] });
  });

  it("leaves out ids that have no slot", () => {
    expect(picksHash(SMALL, ["a", "made-up"])).toBe(picksHash(SMALL, ["a"]));
  });

  it("ignores bits past the last slot", () => {
    expect(picksFromHash("#s=2&p=__8", SMALL)).toEqual({
      status: "picks",
      ids: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
    });
  });

  it("keeps a shared plan with nothing picked", () => {
    expect(picksHash(SMALL, [])).toBe("#s=2&p=");
    expect(picksFromHash("#s=2&p=", SMALL)).toEqual({ status: "picks", ids: [] });
  });

  it("returns none for a hash without picks", () => {
    expect(picksFromHash("", SMALL)).toEqual({ status: "none" });
    expect(picksFromHash("#", SMALL)).toEqual({ status: "none" });
    expect(picksFromHash("#clash-reference", SMALL)).toEqual({ status: "none" });
  });

  it("flags a link from another season", () => {
    expect(picksFromHash("#s=3&p=AQ", SMALL)).toEqual({ status: "other-season" });
  });

  it("flags a link with its season cut off as invalid", () => {
    expect(picksFromHash("#p=AQ", SMALL)).toEqual({ status: "invalid" });
  });

  it("flags most cut-off codes as invalid", () => {
    // "AAAAEAAAIA" cut short: the encoder never writes a trailing zero byte.
    expect(picksFromHash("#s=2&p=AAAAEAAA", SEASON_2)).toEqual({ status: "invalid" });
    // Leftover bits the encoder never writes.
    expect(picksFromHash("#s=2&p=AB", SMALL)).toEqual({ status: "invalid" });
  });

  it("flags a code that isn't base64url as invalid", () => {
    expect(picksFromHash("#s=2&p=A%2BB", SMALL)).toEqual({ status: "invalid" });
    expect(picksFromHash("#s=2&p=A", SMALL)).toEqual({ status: "invalid" });
  });

  it("flags an oversized hash as invalid", () => {
    expect(picksFromHash(`#s=2&p=${"A".repeat(MAX_SHARE_HASH_LENGTH)}`, SMALL)).toEqual({
      status: "invalid",
    });
  });
});
