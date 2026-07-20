import "server-only";

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

import type { PvpTutorial, PvpTutorialFrontmatter } from "../types";

/**
 * Frontmatter-only reads (via `gray-matter`, not a full MDX compile) - ported
 * from `old/tarkov-tips/src/lib/tutorials.ts`'s `getTutorialBySlug`/
 * `getAllTutorials` pattern. Deliberately separate from `lib/mdx.ts`'s
 * `compilePvpTutorialMDX`: listing/metadata pages (the hub, prev/next nav)
 * only need frontmatter + a reading-time estimate, never the compiled MDX
 * tree, so they shouldn't pay for a full async compile just to read a title.
 */
const CONTENT_DIR = path.join(process.cwd(), "src/features/pvp-guide/content");

function readTutorial(slug: string): PvpTutorial {
  const fullPath = path.join(CONTENT_DIR, `${slug}.mdx`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);
  const stats = readingTime(content);

  return {
    slug,
    frontmatter: data as PvpTutorialFrontmatter,
    content,
    readingTimeMinutes: Math.max(1, Math.round(stats.minutes)),
    wordCount: stats.words,
  };
}

/** Every PvP tutorial slug, derived from the `content/` directory's `.mdx` files. */
export function getPvpTutorialSlugs(): readonly string[] {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

/** All PvP tutorials, sorted by frontmatter `order` - every article was authored the same day, so `order` (not `publishedAt`) is this feature's real sort key. */
export function getAllPvpTutorials(): readonly PvpTutorial[] {
  return getPvpTutorialSlugs()
    .map(readTutorial)
    .slice()
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

/** One tutorial by slug, or `undefined` for an unknown slug (callers decide whether that means `notFound()`). */
export function getPvpTutorialBySlug(slug: string): PvpTutorial | undefined {
  if (!getPvpTutorialSlugs().includes(slug)) return undefined;
  return readTutorial(slug);
}
