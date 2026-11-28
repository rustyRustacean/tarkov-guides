import { describe, expect, it } from "vitest";

import { getGuideSource, GUIDE_SOURCES } from "./guide-sources";

describe("GUIDE_SOURCES", () => {
  it("uses unique kebab-case ids", () => {
    const ids = GUIDE_SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("stores plain YouTube watch URLs, so timestamps can be appended", () => {
    for (const { id, url } of GUIDE_SOURCES) {
      expect(url, id).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
    }
  });

  it("records each upload date as YYYY-MM-DD", () => {
    for (const { id, publishedAt } of GUIDE_SOURCES) {
      expect(publishedAt, id).toMatch(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
    }
  });
});

describe("getGuideSource", () => {
  it("finds a source by id and returns undefined for an unknown one", () => {
    expect(getGuideSource("jbobyh-minefields")?.creator).toBe("jbobyh");
    expect(getGuideSource("nope")).toBeUndefined();
  });
});
