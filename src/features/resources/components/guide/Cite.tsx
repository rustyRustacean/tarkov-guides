/** An inline numbered citation that jumps to its entry in the chapter's sources list. */
export function Cite({ number, t }: { number: number; t?: string | undefined }) {
  const label = `Source ${String(number)}`;
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
