import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { parsePicks, savePicks, usePicks } from "./modifier-picks-storage";

const KEY = "test.modifier-picks";
const VALID = new Set(["a", "b", "c"]);

beforeEach(() => {
  savePicks(KEY, []);
  window.localStorage.clear();
});

describe("parsePicks", () => {
  it("keeps known ids once, in stored order", () => {
    expect(parsePicks('["b","a","b","zzz"]', VALID)).toEqual(["b", "a"]);
  });

  it("treats empty, malformed or non-array values as no picks", () => {
    expect(parsePicks("", VALID)).toEqual([]);
    expect(parsePicks("{nope", VALID)).toEqual([]);
    expect(parsePicks('{"a":1}', VALID)).toEqual([]);
    expect(parsePicks("[1,null]", VALID)).toEqual([]);
  });
});

describe("usePicks", () => {
  it("updates when picks are saved and writes them to storage", () => {
    const { result } = renderHook(() => usePicks(KEY, VALID));
    expect(result.current).toEqual([]);

    act(() => {
      savePicks(KEY, ["c", "a"]);
    });

    expect(result.current).toEqual(["c", "a"]);
    expect(window.localStorage.getItem(KEY)).toBe('["c","a"]');
  });
});
