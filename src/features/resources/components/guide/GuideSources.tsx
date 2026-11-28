import { formatSourceDate, youtubeAt, type SourcedCitation } from "../../lib/guide-citations";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * The numbered sources list at the end of a chapter. Each entry credits the
 * creator and video, says when it was published (so readers can judge how
 * current it is), and links every timestamp the chapter cites.
 */
export function GuideSources({ citations }: { citations: readonly SourcedCitation[] }) {
  if (citations.length === 0) return null;

  return (
    <section aria-labelledby="chapter-sources" className="border-border mt-10 border-t pt-6">
      <h2 id="chapter-sources" className="font-display text-xl font-bold">
        Sources
      </h2>
      <ol className="text-muted-foreground mt-4 flex flex-col gap-3 text-sm">
        {citations.map(({ id, number, timestamps, source }) => (
          <li key={id} id={`source-${String(number)}`} className="scroll-mt-24">
            <span className="text-foreground font-medium">[{number}]</span>{" "}
            <a href={source.creatorUrl} {...EXTERNAL} className="text-foreground hover:underline">
              {source.creator}
            </a>
            , &ldquo;
            <a href={source.url} {...EXTERNAL} className="text-primary hover:underline">
              {source.title}
            </a>
            &rdquo;, YouTube, {formatSourceDate(source.publishedAt)}.
            {source.language === "ru" && " Translated from Russian."}
            {timestamps.length > 0 && (
              <>
                {" "}
                Cited at{" "}
                {timestamps.map((t, index) => (
                  <span key={t}>
                    {index > 0 && ", "}
                    <a
                      href={youtubeAt(source.url, t)}
                      {...EXTERNAL}
                      className="text-primary tabular-nums hover:underline"
                    >
                      {t}
                    </a>
                  </span>
                ))}
                .
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
