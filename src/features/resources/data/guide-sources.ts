/**
 * Every outside source a hosted guide cites, keyed by a stable id that MDX
 * uses in `<Cite id="..." />`. A new creator is just more entries here; the
 * content test fails if a chapter cites an id that isn't listed, or if a
 * listed source is never cited.
 */
export interface GuideSource {
  /** Stable kebab-case key, `<creator>-<topic>`. Never change it once cited. */
  id: string;
  creator: string;
  creatorUrl: string;
  /** The video's English title, or our translation when it only has a Russian one. */
  title: string;
  /** Plain watch URL (`https://www.youtube.com/watch?v=...`), so timestamps can be appended. */
  url: string;
  /** Upload date, `YYYY-MM-DD`. Shown next to the source so readers can judge how current it is. */
  publishedAt: string;
  /** What we worked from. `"ru"` adds a "translated from Russian" note to the sources list. */
  language: "en" | "ru";
}

const JBOBYH = { creator: "jbobyh", creatorUrl: "https://www.youtube.com/@jbobyh" } as const;

export const GUIDE_SOURCES: readonly GuideSource[] = [
  {
    ...JBOBYH,
    id: "jbobyh-bot-vision",
    title: "Bot vision: bush bugs, 360° FOV, and reactions to a flashlight",
    url: "https://www.youtube.com/watch?v=IkuoU6jyRBo",
    publishedAt: "2026-11-10",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-hitboxes",
    title: "Hitboxes and damage registration in Tarkov",
    url: "https://www.youtube.com/watch?v=0_S-UtdBYYQ",
    publishedAt: "2026-10-03",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-penetration",
    title: "How penetration works in Tarkov [Mechanics Breakdown]",
    url: "https://www.youtube.com/watch?v=GcbkAjSoPn0",
    publishedAt: "2026-09-15",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-gravel",
    title: "Why isn't this being fixed?",
    url: "https://www.youtube.com/watch?v=Zwwosdo3SV4",
    publishedAt: "2025-05-06",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-grenades-0-16",
    title: "How do grenades work now? New mechanics and damage | Tarkov 0.16",
    url: "https://www.youtube.com/watch?v=ojpjA9Qtais",
    publishedAt: "2025-05-18",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-grenades-2024",
    title: "How do grenades work in Tarkov in 2024?",
    url: "https://www.youtube.com/watch?v=e7XnnyHuQho",
    publishedAt: "2024-10-23",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-rshg-2",
    title: "The hidden mechanics of the RShG-2 grenade launcher in Tarkov",
    url: "https://www.youtube.com/watch?v=rJtLuHt7dxg",
    publishedAt: "2025-05-11",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-minefields",
    title: "How do minefields work in Tarkov? [Mechanics breakdown]",
    url: "https://www.youtube.com/watch?v=CuNKxgOHtbo",
    publishedAt: "2025-11-11",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-sniper-zones",
    title: "How do sniper zones work in Tarkov? [Mechanics breakdown]",
    url: "https://www.youtube.com/watch?v=Li9tm8I6D-k",
    publishedAt: "2025-12-01",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-claymores",
    title: "How claymore works in tarkov? [Mechanics breakdown]",
    url: "https://www.youtube.com/watch?v=FDXgvrKuM80",
    publishedAt: "2026-08-15",
    language: "ru",
  },
  {
    ...JBOBYH,
    id: "jbobyh-frame-rate",
    title: "Tarkov punishes high FPS (low FPS too, but differently)",
    url: "https://www.youtube.com/watch?v=RgwlELSofV4",
    publishedAt: "2026-11-19",
    language: "en",
  },
];

/** The source for an id, or `undefined` when none is registered. */
export function getGuideSource(id: string): GuideSource | undefined {
  return GUIDE_SOURCES.find((source) => source.id === id);
}
