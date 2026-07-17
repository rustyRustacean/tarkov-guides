import { describe, expect, it } from "vitest";

import {
  getNextTutorialInPath,
  getPreviousTutorialInPath,
  getPvpLearningPathWithTutorials,
  getTutorialProgressInPath,
  PVP_LEARNING_PATH,
} from "./pvp-learning-path";

describe("PVP_LEARNING_PATH", () => {
  it("has 2 essential, 2 intermediate, 2 advanced items in slug order pvp1,pvp3,pvp4,pvp5,pvp8,pvp9", () => {
    expect(PVP_LEARNING_PATH.items.map((i) => i.tutorialSlug)).toEqual([
      "pvp1",
      "pvp3",
      "pvp4",
      "pvp5",
      "pvp8",
      "pvp9",
    ]);
    expect(PVP_LEARNING_PATH.items.map((i) => i.tier)).toEqual([
      "essential",
      "essential",
      "intermediate",
      "intermediate",
      "advanced",
      "advanced",
    ]);
  });

  it("totalTime matches the sum of each item's estimatedTime", () => {
    const sum = PVP_LEARNING_PATH.items.reduce((acc, item) => acc + item.estimatedTime, 0);
    expect(PVP_LEARNING_PATH.totalTime).toBe(sum);
  });
});

describe("getPvpLearningPathWithTutorials", () => {
  it("joins every item with its real, compiled tutorial metadata", () => {
    const items = getPvpLearningPathWithTutorials();
    expect(items).toHaveLength(6);
    for (const item of items) {
      expect(item.tutorial?.slug).toBe(item.tutorialSlug);
    }
  });
});

describe("getNextTutorialInPath / getPreviousTutorialInPath", () => {
  it("walks forward and backward through the real path in order", () => {
    expect(getNextTutorialInPath("pvp1")?.tutorialSlug).toBe("pvp3");
    expect(getNextTutorialInPath("pvp9")).toBeNull();
    expect(getPreviousTutorialInPath("pvp3")?.tutorialSlug).toBe("pvp1");
    expect(getPreviousTutorialInPath("pvp1")).toBeNull();
  });

  it("returns null for an unknown slug in either direction", () => {
    expect(getNextTutorialInPath("not-a-real-slug")).toBeNull();
    expect(getPreviousTutorialInPath("not-a-real-slug")).toBeNull();
  });
});

describe("getTutorialProgressInPath", () => {
  it("reports 1-based position and percentage through the real 6-item path", () => {
    expect(getTutorialProgressInPath("pvp1")).toEqual({ current: 1, total: 6, percentage: 17 });
    expect(getTutorialProgressInPath("pvp9")).toEqual({ current: 6, total: 6, percentage: 100 });
  });

  it("reports current: 0 for an unknown slug", () => {
    expect(getTutorialProgressInPath("not-a-real-slug")).toEqual({
      current: 0,
      total: 6,
      percentage: 0,
    });
  });
});
