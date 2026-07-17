import { notFound } from "next/navigation";

import { PvpTutorialPage } from "@/features/pvp-guide/components/PvpTutorialPage";
import { compilePvpTutorialMDX } from "@/features/pvp-guide/lib/mdx";
import {
  getNextTutorialInPath,
  getPreviousTutorialInPath,
  getTutorialProgressInPath,
} from "@/features/pvp-guide/lib/pvp-learning-path";
import {
  getPvpTutorialBySlug,
  getPvpTutorialSlugs,
} from "@/features/pvp-guide/lib/tutorial-content";

interface Props {
  params: Promise<{ slug: string }>;
}

/** All 6 real slugs are known at build time - prerender every tutorial page rather than compiling MDX on first request. */
export function generateStaticParams(): { slug: string }[] {
  return getPvpTutorialSlugs().map((slug) => ({ slug }));
}

/** Route entry for one PvP tutorial's detail page - thin, delegates to the feature component. */
export default async function PvpTutorialRoute({ params }: Props) {
  const { slug } = await params;
  const tutorial = getPvpTutorialBySlug(slug);
  if (!tutorial) notFound();

  const content = await compilePvpTutorialMDX(tutorial.content);

  return (
    <PvpTutorialPage
      tutorial={tutorial}
      content={content}
      previous={getPreviousTutorialInPath(slug)}
      next={getNextTutorialInPath(slug)}
      progress={getTutorialProgressInPath(slug)}
    />
  );
}
