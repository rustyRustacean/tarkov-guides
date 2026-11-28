/**
 * Numbered citations for guide chapters. A chapter's MDX cites a source with
 * `<Cite id="source-id" t="m:ss" />` (the timestamp is optional). The raw MDX
 * is scanned before compiling, so the number on each inline citation and the
 * order of the sources list at the end always come from the same pass.
 */

import type { GuideSource } from "../data/guide-sources";

/** Matches one `<Cite />` tag. Attributes are always `id` then an optional `t`, which the content test enforces. */
export const CITE_PATTERN = /<Cite\s+id="([a-z0-9-]+)"(?:\s+t="(\d{1,2}(?::\d{2}){1,2})")?\s*\/>/g;

/** One cited source in a chapter, numbered by first use. */
export interface GuideCitation {
  id: string;
  number: number;
  /** Every timestamp the chapter cites in this source, once each, in video order. */
  timestamps: readonly string[];
}

/** A citation with its registry entry attached, as the sources list renders it. */
export interface SourcedCitation extends GuideCitation {
  source: GuideSource;
}

/** Every source a chapter body cites, numbered 1, 2, 3 in order of first use. */
export function collectCitations(body: string): GuideCitation[] {
  const byId = new Map<string, { number: number; timestamps: string[] }>();
  for (const [, id, t] of body.matchAll(CITE_PATTERN)) {
    if (!id) continue;
    let entry = byId.get(id);
    if (!entry) {
      entry = { number: byId.size + 1, timestamps: [] };
      byId.set(id, entry);
    }
    if (t && !entry.timestamps.includes(t)) entry.timestamps.push(t);
  }
  return [...byId].map(([id, { number, timestamps }]) => ({
    id,
    number,
    timestamps: timestamps.sort((a, b) => timestampSeconds(a) - timestampSeconds(b)),
  }));
}

/** `m:ss` or `h:mm:ss` as whole seconds. */
export function timestampSeconds(t: string): number {
  return t.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/** A YouTube watch URL that starts playing at `t`. */
export function youtubeAt(url: string, t: string): string {
  return `${url}&t=${String(timestampSeconds(t))}s`;
}

const SOURCE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** `2026-11-10` as `10 Nov 2026`, read as UTC so the day never shifts with the viewer's time zone. */
export function formatSourceDate(isoDate: string): string {
  return SOURCE_DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}
