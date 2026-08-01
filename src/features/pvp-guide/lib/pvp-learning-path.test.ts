import { describe, expect, it } from "vitest";

import {
  getNextTutorialInPath,
  getPreviousTutorialInPath,
  getPvpLearningPathWithTutorials,
  getTutorialProgressInPath,
  PVP_LEARNING_PATH,
} from "./pvp-learning-path";

describe("PVP_LEARNING_PATH", () => {
  it("has 2 essential, 2 intermediate, 2 advanced items in the expected slug order", () => {
    expect(PVP_LEARNING_PATH.items.map((i) => i.tutorialSlug)).toEqual([
      "circle-strafing",
      "peeking-essentials",
      "crosshair-placement",
      "gathering-intel",
      "wiggle",
      "jump-shots",
    ]);
    expect(PVP_LEARNING_PATH.items.map((i) => i.tier)).toEqual([
      "essential",
      "intermediate",
      "essential",
      "intermediate",
      "advanced",
      "advanced",
    ]);
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
    expect(getNextTutorialInPath("circle-strafing")?.tutorialSlug).toBe("peeking-essentials");
    expect(getNextTutorialInPath("jump-shots")).toBeNull();
    expect(getPreviousTutorialInPath("peeking-essentials")?.tutorialSlug).toBe("circle-strafing");
    expect(getPreviousTutorialInPath("circle-strafing")).toBeNull();
  });

  it("returns null for an unknown slug in either direction", () => {
    expect(getNextTutorialInPath("not-a-real-slug")).toBeNull();
    expect(getPreviousTutorialInPath("not-a-real-slug")).toBeNull();
  });
});

describe("getTutorialProgressInPath", () => {
  it("reports 1-based position through the real 6-item path", () => {
    expect(getTutorialProgressInPath("circle-strafing")).toEqual(
      expect.objectContaining({ current: 1, total: 6 }),
    );
    expect(getTutorialProgressInPath("jump-shots")).toEqual(
      expect.objectContaining({ current: 6, total: 6 }),
    );
  });

  it("reports 0% for the first chapter - nothing comes before it", () => {
    expect(getTutorialProgressInPath("circle-strafing").percentage).toBe(0);
  });

  it("weights percentage by each chapter's real word count, not just position", () => {
    // Hand-computed from the same real tutorial data `getTutorialProgressInPath` reads,
    // rather than a hardcoded number - chapter word counts change as content gets written,
    // and a flat position-based percentage (current/total) is exactly what this rejects:
    // Peeking Essentials is ~2000 words while Wiggle is currently a two-sentence stub, so
    // they shouldn't move the bar by the same amount.
    const path = getPvpLearningPathWithTutorials();
    const totalWords = path.reduce((sum, item) => sum + (item.tutorial?.wordCount ?? 0), 0);
    const index = path.findIndex((item) => item.tutorialSlug === "gathering-intel");
    const priorWords = path
      .slice(0, index)
      .reduce((sum, item) => sum + (item.tutorial?.wordCount ?? 0), 0);

    expect(getTutorialProgressInPath("gathering-intel").percentage).toBe(
      Math.round((priorWords / totalWords) * 100),
    );
  });

  it("percentage never decreases as you move through the path", () => {
    const path = getPvpLearningPathWithTutorials();
    const percentages = path.map((item) => getTutorialProgressInPath(item.tutorialSlug).percentage);
    let previous = -Infinity;
    for (const percentage of percentages) {
      expect(percentage).toBeGreaterThanOrEqual(previous);
      previous = percentage;
    }
  });

  it("reports current: 0 for an unknown slug", () => {
    expect(getTutorialProgressInPath("not-a-real-slug")).toEqual({
      current: 0,
      total: 6,
      percentage: 0,
    });
  });
});
