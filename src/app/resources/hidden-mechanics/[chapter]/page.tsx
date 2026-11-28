import { notFound } from "next/navigation";

import { GuideChapterPage } from "@/features/resources/components/guide/GuideChapterPage";
import { getGuideChapter, getGuideChapterSlugs } from "@/features/resources/lib/guide-content";
import { compileGuideChapter } from "@/features/resources/lib/guide-mdx";
import { requireHostedResource } from "@/features/resources/lib/resource-metadata";

import type { Metadata } from "next";

const SLUG = "hidden-mechanics";

interface Props {
  params: Promise<{ chapter: string }>;
}

/** Unknown chapters 404 straight away instead of rendering on demand. */
export const dynamicParams = false;

/** Every chapter is known at build time, so each one is prerendered rather than compiled on first request. */
export function generateStaticParams(): { chapter: string }[] {
  return getGuideChapterSlugs().map((chapter) => ({ chapter }));
}

/** Each chapter's own title and description, under the guide's name. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapter } = await params;
  const found = getGuideChapter(chapter);
  if (!found) return {};
  const { title, description } = found.chapter.frontmatter;
  return { title: `${title} | ${requireHostedResource(SLUG).title} | TarkovGuides`, description };
}

/** Route entry for one Hidden Mechanics chapter: thin, delegates to the feature component. */
export default async function HiddenMechanicsChapterRoute({ params }: Props) {
  const { chapter: slug } = await params;
  const found = getGuideChapter(slug);
  if (!found) notFound();

  const { content, citations } = await compileGuideChapter(found.chapter.content);

  return (
    <GuideChapterPage
      guide={requireHostedResource(SLUG)}
      chapter={found.chapter}
      chapterNumber={found.index + 1}
      content={content}
      citations={citations}
      previous={found.previous}
      next={found.next}
    />
  );
}
