import { describe, expect, it } from "vitest";

import { getAllPvpTutorials, getPvpTutorialBySlug, getPvpTutorialSlugs } from "./tutorial-content";

describe("getPvpTutorialSlugs", () => {
  it("returns exactly the 6 real tutorial slugs", () => {
    expect(getPvpTutorialSlugs().slice().sort()).toEqual([
      "pvp1",
      "pvp3",
      "pvp4",
      "pvp5",
      "pvp8",
      "pvp9",
    ]);
  });
});

describe("getAllPvpTutorials", () => {
  it("sorts by frontmatter order, not filename/publishedAt", () => {
    const tutorials = getAllPvpTutorials();
    expect(tutorials.map((t) => t.slug)).toEqual(["pvp1", "pvp3", "pvp4", "pvp5", "pvp8", "pvp9"]);
    expect(tutorials.map((t) => t.frontmatter.order)).toEqual([1, 3, 4, 5, 8, 9]);
  });

  it("parses real frontmatter and strips it from content", () => {
    const pvp1 = getAllPvpTutorials().find((t) => t.slug === "pvp1");
    expect(pvp1?.frontmatter.title).toBe("Understanding Tarkov Movement: Inertia Basics");
    expect(pvp1?.frontmatter.difficulty).toBe("beginner");
    expect(pvp1?.content).not.toContain("---");
    expect(pvp1?.content).not.toContain("title:");
  });

  it("computes a positive whole-number reading time for every tutorial", () => {
    for (const tutorial of getAllPvpTutorials()) {
      expect(tutorial.readingTimeMinutes).toBeGreaterThan(0);
      expect(Number.isInteger(tutorial.readingTimeMinutes)).toBe(true);
    }
  });

  it("never leaves a category or series field in frontmatter (decision #3)", () => {
    for (const tutorial of getAllPvpTutorials()) {
      expect(tutorial.frontmatter).not.toHaveProperty("category");
      expect(tutorial.frontmatter).not.toHaveProperty("series");
    }
  });

  it("never leaves a GIF placeholder marker in any tutorial's content", () => {
    for (const tutorial of getAllPvpTutorials()) {
      expect(tutorial.content).not.toContain("GIF PLACEHOLDER");
    }
  });
});

describe("getPvpTutorialBySlug", () => {
  it("returns the matching tutorial for a real slug", () => {
    expect(getPvpTutorialBySlug("pvp4")?.frontmatter.title).toBe("Advanced Peeking Techniques");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getPvpTutorialBySlug("pvp2")).toBeUndefined();
    expect(getPvpTutorialBySlug("not-a-real-slug")).toBeUndefined();
  });
});
