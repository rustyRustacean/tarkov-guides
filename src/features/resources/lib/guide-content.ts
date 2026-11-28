import "server-only";

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

/** Frontmatter for one guide chapter's MDX file. */
interface GuideChapterFrontmatter {
  title: string;
  description: string;
  /** Sort key within the guide; unique per guide. */
  order: number;
  publishedAt: string;
  updatedAt: string;
}

/** One guide chapter's raw MDX body plus its parsed frontmatter. */
export interface GuideChapter {
  slug: string;
  frontmatter: GuideChapterFrontmatter;
  /** MDX body with the frontmatter stripped, compiled on demand by `lib/guide-mdx.tsx`. */
  content: string;
  readingTimeMinutes: number;
}

/**
 * Reads the Hidden Mechanics chapters from `content/hidden-mechanics/*.mdx`.
 * Mirrors `pvp-guide/lib/tutorial-content.ts`: frontmatter and a
 * reading-time estimate only, so listing pages never pay for an MDX compile.
 */
const CONTENT_DIR = path.join(process.cwd(), "src/features/resources/content/hidden-mechanics");

/** The body without self-closing JSX tags (citations, diagrams) or link targets, so reading time counts only prose. */
function proseOnly(content: string): string {
  return content.replace(/<[^>]*\/>/g, "").replace(/\]\([^)]*\)/g, "]");
}

function readChapter(slug: string): GuideChapter {
  const { data, content } = matter(fs.readFileSync(path.join(CONTENT_DIR, `${slug}.mdx`), "utf8"));
  return {
    slug,
    frontmatter: data as GuideChapterFrontmatter,
    content,
    readingTimeMinutes: Math.max(1, Math.round(readingTime(proseOnly(content)).minutes)),
  };
}

/** Every chapter slug, from the `.mdx` filenames. */
export function getGuideChapterSlugs(): readonly string[] {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

/** Every chapter, sorted by frontmatter `order`. */
export function getGuideChapters(): readonly GuideChapter[] {
  return getGuideChapterSlugs()
    .map(readChapter)
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

/** One chapter, its zero-based position in reading order, and its neighbours, or `undefined` for an unknown slug. */
export function getGuideChapter(slug: string):
  | {
      chapter: GuideChapter;
      index: number;
      previous: GuideChapter | undefined;
      next: GuideChapter | undefined;
    }
  | undefined {
  const chapters = getGuideChapters();
  const index = chapters.findIndex((chapter) => chapter.slug === slug);
  const chapter = chapters[index];
  if (!chapter) return undefined;
  return { chapter, index, previous: chapters[index - 1], next: chapters[index + 1] };
}
