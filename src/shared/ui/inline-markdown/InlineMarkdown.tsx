interface Props {
  text: string;
  /** Applied to each `**bold**` span. Defaults to a semibold, full-contrast style so emphasis reads clearly against muted body text. */
  boldClassName?: string;
  /** Applied to each `[text](href)` link. Defaults to the site's standard inline-link treatment. */
  linkClassName?: string;
}

const TOKEN_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/;

/**
 * Renders a plain string with support for two bits of inline markdown that
 * plain `{text}` interpolation can't express: `**bold**` spans, and
 * `[text](href)` links (used for same-page anchor links between PvP guide
 * quick-summary cards, e.g. linking "Gathering Intel" to `#gathering-intel`).
 * Deliberately not a full markdown renderer: pulling in a parser for two
 * inline rules would be overkill, and full guide articles already get real
 * MDX compilation separately via `next-mdx-remote` (see `pvp-guide/lib/mdx.ts`).
 */
export function InlineMarkdown({
  text,
  boldClassName = "text-foreground font-semibold",
  linkClassName = "text-primary hover:text-primary/80 underline underline-offset-2",
}: Props) {
  const parts = text.split(TOKEN_PATTERN);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} className={boldClassName}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        const linkMatch = LINK_PATTERN.exec(part);
        if (linkMatch) {
          const [, linkText, href] = linkMatch;
          return (
            <a key={index} href={href} className={linkClassName}>
              {linkText}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}
