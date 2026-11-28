import { describe, expect, it } from "vitest";

import {
  isPublicPresetId,
  manageKeyFromHash,
  publicPresetManagePath,
  publicPresetPath,
  sortPublicPresets,
  type PublicPresetSummary,
} from "./public-presets";

const KEY = "a".repeat(43);

function summary(id: string, name: string, uses: number): PublicPresetSummary {
  return { id, name, uses, rules: 3, publishedAt: 0 };
}

describe("sortPublicPresets", () => {
  it("ranks by uses, then name, then id", () => {
    const sorted = sortPublicPresets([
      summary("aaaaaaaaab", "bolt only", 2),
      summary("aaaaaaaaac", "DMR only", 5),
      summary("aaaaaaaaad", "Bolt only", 2),
      summary("aaaaaaaaae", "Armorless", 2),
    ]);
    expect(sorted.map((preset) => preset.id)).toEqual([
      "aaaaaaaaac",
      "aaaaaaaaae",
      "aaaaaaaaab",
      "aaaaaaaaad",
    ]);
  });

  it("doesn't reorder the list it was given", () => {
    const list = [summary("aaaaaaaaab", "B", 0), summary("aaaaaaaaac", "A", 0)];
    sortPublicPresets(list);
    expect(list[0]?.id).toBe("aaaaaaaaab");
  });
});

describe("links", () => {
  it("builds the public page and the owner's manage link", () => {
    expect(publicPresetPath("abcdefghjk")).toBe("/resources/events/presets/abcdefghjk");
    expect(publicPresetManagePath("abcdefghjk", KEY)).toBe(
      `/resources/events/presets/abcdefghjk#manage=${KEY}`,
    );
  });

  it("reads a manage key from the fragment, ignoring malformed ones", () => {
    expect(manageKeyFromHash(`#manage=${KEY}`)).toBe(KEY);
    expect(manageKeyFromHash(`manage=${KEY}`)).toBe(KEY);
    expect(manageKeyFromHash("#manage=short")).toBeNull();
    expect(manageKeyFromHash(`#edit=${KEY}`)).toBeNull();
  });

  it("accepts only well-formed preset ids", () => {
    expect(isPublicPresetId("abcdefghjk")).toBe(true);
    expect(isPublicPresetId("ABCDEFGHJK")).toBe(false);
    expect(isPublicPresetId("abc")).toBe(false);
    expect(isPublicPresetId(null)).toBe(false);
  });
});
