import { describe, expect, it } from "vitest";

import { getAllPvpTutorials, getPvpTutorialBySlug, getPvpTutorialSlugs } from "./tutorial-content";

describe("getPvpTutorialSlugs", () => {
  it("returns exactly the 6 real tutorial slugs", () => {
    expect(getPvpTutorialSlugs().slice().sort()).toEqual([
      "circle-strafing",
      "crosshair-placement",
      "gathering-intel",
      "jump-shots",
      "peeking-essentials",
      "wiggle",
    ]);
  });
});

describe("getAllPvpTutorials", () => {
  it("sorts by frontmatter order, not filename/publishedAt", () => {
    const tutorials = getAllPvpTutorials();
    expect(tutorials.map((t) => t.slug)).toEqual([
      "circle-strafing",
      "crosshair-placement",
      "peeking-essentials",
      "gathering-intel",
      "wiggle",
      "jump-shots",
    ]);
    expect(tutorials.map((t) => t.frontmatter.order)).toEqual([1, 3, 10, 11, 12, 13]);
  });

  it("parses real frontmatter and strips it from content", () => {
    const circleStrafing = getAllPvpTutorials().find((t) => t.slug === "circle-strafing");
    expect(circleStrafing?.frontmatter.title).toBe("Understanding Tarkov Movement: Inertia Basics");
    expect(circleStrafing?.frontmatter.difficulty).toBe("beginner");
    expect(circleStrafing?.content).not.toContain("---");
    expect(circleStrafing?.content).not.toContain("title:");
  });

  it("computes a positive whole-number reading time for every tutorial", () => {
    for (const tutorial of getAllPvpTutorials()) {
      expect(tutorial.readingTimeMinutes).toBeGreaterThan(0);
      expect(Number.isInteger(tutorial.readingTimeMinutes)).toBe(true);
    }
  });

  it("computes a positive word count for every tutorial, from the same reading-time call", () => {
    for (const tutorial of getAllPvpTutorials()) {
      expect(tutorial.wordCount).toBeGreaterThan(0);
      expect(Number.isInteger(tutorial.wordCount)).toBe(true);
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
    expect(getPvpTutorialBySlug("jump-shots")?.frontmatter.title).toBe("Jump Shots");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getPvpTutorialBySlug("pvp2")).toBeUndefined();
    expect(getPvpTutorialBySlug("not-a-real-slug")).toBeUndefined();
  });
});
