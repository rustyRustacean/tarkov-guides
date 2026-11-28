/** An inline numbered citation that jumps to its entry in the chapter's sources list. */
export function Cite({ number, t }: { number: number; t?: string | undefined }) {
  // The name starts with the visible "[1]" so voice control users can say what they see.
  const label = `[${String(number)}] Source`;
  return (
    <sup className="ml-0.5">
      <a
        href={`#source-${String(number)}`}
        aria-label={t ? `${label}, at ${t}` : label}
        className="text-primary font-medium no-underline hover:underline"
      >
        [{number}]
      </a>
    </sup>
  );
}
