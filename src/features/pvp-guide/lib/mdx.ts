import "server-only";

import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { ImageCompareSlider } from "../components/ImageCompareSlider";
import { VideoClip } from "../components/VideoClip";
import { VideoCompareSlider } from "../components/VideoCompareSlider";

import type { ReactElement } from "react";

const mdxComponents = { VideoClip, VideoCompareSlider, ImageCompareSlider };

/** The remark and rehype plugins every MDX page on the site compiles with (the PvP guide and the Resources hub's guides). */
export const MDX_OPTIONS = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { properties: { className: ["anchor"] } }]],
} satisfies NonNullable<NonNullable<Parameters<typeof compileMDX>[0]["options"]>["mdxOptions"]>;

/**
 * Compiles one tutorial's MDX **body** (frontmatter already stripped and
 * parsed separately by `lib/tutorial-content.ts`'s `gray-matter` read, so no
 * `parseFrontmatter` here and no double-parse/reserialize round trip) into a
 * real React tree. Ported from `old/tarkov-tips/src/lib/mdx.ts`.
 */
export async function compilePvpTutorialMDX(body: string): Promise<ReactElement> {
  const { content } = await compileMDX({
    source: body,
    components: mdxComponents,
    options: { mdxOptions: MDX_OPTIONS },
  });

  return content;
}
