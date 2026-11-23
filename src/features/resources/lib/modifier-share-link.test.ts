import { describe, expect, it } from "vitest";

import { MAX_SHARE_HASH_LENGTH, picksFromHash, picksHash } from "./modifier-share-link";

const SEASON = "untar-control";
const VALID = new Set(["average", "no-flea-market", "lucky", "prodigy"]);

describe("picksHash and picksFromHash", () => {
  it("round-trips picks in order", () => {
    const hash = picksHash(SEASON, ["no-flea-market", "average"]);

    expect(hash).toBe("#season=untar-control&picks=no-flea-market,average");
    expect(picksFromHash(hash, SEASON, VALID)).toEqual({
      status: "picks",
      ids: ["no-flea-market", "average"],
    });
  });

  it("drops unknown and duplicate ids", () => {
    const hash = "#season=untar-control&picks=lucky,made-up,lucky,,%3Cscript%3E,prodigy";

    expect(picksFromHash(hash, SEASON, VALID)).toEqual({
      status: "picks",
      ids: ["lucky", "prodigy"],
    });
  });

  it("keeps a shared plan with nothing picked", () => {
    expect(picksFromHash(picksHash(SEASON, []), SEASON, VALID)).toEqual({
      status: "picks",
      ids: [],
    });
  });

  it("returns none for a hash without picks", () => {
    expect(picksFromHash("", SEASON, VALID)).toEqual({ status: "none" });
    expect(picksFromHash("#", SEASON, VALID)).toEqual({ status: "none" });
    expect(picksFromHash("#clash-reference", SEASON, VALID)).toEqual({ status: "none" });
  });

  it("flags a link from another season", () => {
    expect(picksFromHash("#season=some-later-season&picks=lucky", SEASON, VALID)).toEqual({
      status: "other-season",
    });
  });

  it("flags a link with its season cut off as invalid", () => {
    expect(picksFromHash("#picks=lucky", SEASON, VALID)).toEqual({ status: "invalid" });
  });

  it("flags an oversized hash as invalid", () => {
    const hash = `#season=untar-control&picks=${"lucky,".repeat(MAX_SHARE_HASH_LENGTH)}`;

    expect(picksFromHash(hash, SEASON, VALID)).toEqual({ status: "invalid" });
  });
});
