import "server-only";

import { compileMDX } from "next-mdx-remote/rsc";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { AutoplayVideo } from "../components/AutoplayVideo";
import { SkipToVideo } from "../components/SkipToVideo";

import type { ReactElement } from "react";

const mdxComponents = { AutoplayVideo, SkipToVideo };

/**
 * Compiles one tutorial's MDX **body** (frontmatter already stripped and
 * parsed separately by `lib/tutorial-content.ts`'s `gray-matter` read - no
 * `parseFrontmatter` here, so there's no double-parse/reserialize round
 * trip) into a real React tree. Ported from `old/tarkov-tips/src/lib/mdx.ts`.
 */
export async function compilePvpTutorialMDX(body: string): Promise<ReactElement> {
  const { content } = await compileMDX({
    source: body,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { properties: { className: ["anchor"] } }],
        ],
      },
    },
  });

  return content;
}
