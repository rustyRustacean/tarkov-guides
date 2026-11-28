import { describe, expect, it } from "vitest";

import { GUIDE_SOURCES } from "../data/guide-sources";

import { CITE_PATTERN, collectCitations } from "./guide-citations";
import { getGuideChapter, getGuideChapters, getGuideChapterSlugs } from "./guide-content";

const chapters = getGuideChapters();

describe("getGuideChapters", () => {
  it("reads every chapter, sorted by a unique frontmatter order", () => {
    expect(chapters.map((chapter) => chapter.slug)).toEqual([
      "ai-vision",
      "hitboxes-and-damage",
      "penetration",
      "explosives",
      "map-hazards",
      "frame-rate",
    ]);
    const orders = chapters.map((chapter) => chapter.frontmatter.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("parses complete frontmatter and strips it from the body", () => {
    for (const { slug, frontmatter, content, readingTimeMinutes } of chapters) {
      expect(frontmatter.title, slug).toBeTruthy();
      expect(frontmatter.description, slug).toBeTruthy();
      expect(frontmatter.publishedAt, slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(frontmatter.updatedAt, slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(content, slug).not.toMatch(/^---/);
      expect(readingTimeMinutes, slug).toBeGreaterThan(0);
    }
  });

  it("lists the same slugs as getGuideChapterSlugs", () => {
    expect(getGuideChapterSlugs().slice().sort()).toEqual(
      chapters.map((chapter) => chapter.slug).sort(),
    );
  });
});

describe("getGuideChapter", () => {
  it("returns a chapter with its position and neighbours", () => {
    const found = getGuideChapter("hitboxes-and-damage");
    expect(found?.index).toBe(1);
    expect(found?.previous?.slug).toBe("ai-vision");
    expect(found?.next?.slug).toBe("penetration");
  });

  it("has no previous for the first chapter and no next for the last", () => {
    expect(getGuideChapter("ai-vision")?.previous).toBeUndefined();
    expect(getGuideChapter("frame-rate")?.next).toBeUndefined();
  });

  it("returns undefined for an unknown chapter", () => {
    expect(getGuideChapter("nope")).toBeUndefined();
  });
});

describe("guide chapter content", () => {
  it("writes every <Cite> in the one form the citation scan reads", () => {
    for (const { slug, content } of chapters) {
      const tags = content.match(/<Cite\b/g)?.length ?? 0;
      const parsed = [...content.matchAll(CITE_PATTERN)].length;
      expect(parsed, slug).toBe(tags);
    }
  });

  it("cites only registered sources, and every registered source somewhere", () => {
    const registered = new Set(GUIDE_SOURCES.map((source) => source.id));
    const cited = new Set<string>();
    for (const { slug, content } of chapters) {
      for (const { id } of collectCitations(content)) {
        expect(registered.has(id), `${slug} cites unknown source "${id}"`).toBe(true);
        cited.add(id);
      }
    }
    expect([...registered].filter((id) => !cited.has(id))).toEqual([]);
  });

  it("cites at least one source in every chapter", () => {
    for (const { slug, content } of chapters) {
      expect(collectCitations(content).length, slug).toBeGreaterThan(0);
    }
  });

  it("never uses em or en dashes, or a spaced hyphen as a dash", () => {
    for (const { slug, content, frontmatter } of chapters) {
      const text = `${frontmatter.title}\n${frontmatter.description}\n${content}`;
      expect(text, slug).not.toMatch(/[\u2013\u2014]/);
      // List bullets and table separator rows (`| --- |`) are markdown, not punctuation.
      const prose = text.replace(/^[ \t]*- /gm, "").replace(/^\|[\s|:-]+\|\r?$/gm, "");
      expect(prose, slug).not.toMatch(/[ \t]-[ \t]/);
    }
  });
});
