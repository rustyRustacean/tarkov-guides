import "server-only";

import { compileMDX } from "next-mdx-remote/rsc";

import { MDX_OPTIONS } from "@/features/pvp-guide/lib/mdx";

import { Cite } from "../components/guide/Cite";
import { GUIDE_DIAGRAMS } from "../components/guide/diagrams";
import { getGuideSource } from "../data/guide-sources";

import { collectCitations, type SourcedCitation } from "./guide-citations";

import type { ReactElement } from "react";

/**
 * Compiles one guide chapter's MDX body, with the same plugins as the PvP
 * guide (`pvp-guide/lib/mdx.ts`). Citations are numbered from the raw body
 * first, and `<Cite />` reads its number from that pass, so the inline
 * numbers and the sources list can never disagree. An unknown source id
 * throws, which fails the build rather than shipping a broken citation.
 */
export async function compileGuideChapter(
  body: string,
): Promise<{ content: ReactElement; citations: readonly SourcedCitation[] }> {
  const citations = collectCitations(body).map((citation) => {
    const source = getGuideSource(citation.id);
    if (!source) throw new Error(`Cited source "${citation.id}" is not in data/guide-sources.ts`);
    return { ...citation, source };
  });
  const numbers = new Map(citations.map(({ id, number }) => [id, number]));

  const { content } = await compileMDX({
    source: body,
    components: {
      ...GUIDE_DIAGRAMS,
      Cite: ({ id, t }: { id: string; t?: string }) => {
        const number = numbers.get(id);
        if (number === undefined) {
          throw new Error(`<Cite id="${id}"> is not in the form the citation scan reads`);
        }
        return <Cite number={number} t={t} />;
      },
    },
    options: { mdxOptions: MDX_OPTIONS },
  });

  return { content, citations };
}
