// Pulls task guide text + screenshots from the EFT fandom wiki, ported from
// `old/TarkovTrackerWB-main/src/lib/wiki.js`. The MediaWiki `action=parse` API
// serves anonymous CORS (`origin=*`), so this runs client-side. Only text
// content and image URLs are extracted (never raw HTML injected), so there's
// no XSS surface. Every fetcher degrades to empty on any failure.

const WIKI_API = "https://escapefromtarkov.fandom.com/api.php";

export interface WikiImage {
  url: string;
  caption: string;
}

/** Wiki page slug from a task's `wikiLink` (last path segment, decoded), else the task name underscored. */
export function wikiSlugFromLink(wikiLink: string | null, fallbackName: string): string {
  if (wikiLink) {
    const last = wikiLink.split("/").pop() ?? "";
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return fallbackName.replace(/\s+/g, "_");
}

async function fetchWikiDoc(slug: string): Promise<Document | null> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(slug)}&format=json&origin=*&prop=text`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const json: unknown = await response.json();
  const html =
    typeof json === "object" && json !== null
      ? ((json as { parse?: { text?: { "*"?: unknown } } }).parse?.text?.["*"] ?? "")
      : "";
  if (typeof html !== "string" || html.length === 0) return null;
  return new DOMParser().parseFromString(html, "text/html");
}

/**
 * The task's "Guide"/"Walkthrough"/"Strategy" section text only - walks
 * headings in order, keeping paragraphs/lists between that heading and the
 * next one. Other sections (dialogue, requirements, rewards, trivia) are
 * skipped since the popup already shows its own versions.
 */
export async function fetchWikiGuideText(slug: string): Promise<string> {
  if (!slug) return "";
  const doc = await fetchWikiDoc(slug).catch(() => null);
  if (!doc) return "";
  const root = doc.querySelector(".mw-parser-output") ?? doc.body;
  const paragraphs: string[] = [];
  let inGuide = false;
  for (const el of Array.from(root.children)) {
    const tag = el.tagName.toLowerCase();
    if (/^h[234]$/.test(tag)) {
      const title = el.textContent
        .replace(/\[edit\]/gi, "")
        .trim()
        .toLowerCase();
      if (/^(guide|walkthrough|strategy)/.test(title)) {
        inGuide = true;
        continue;
      }
      if (inGuide) break;
      continue;
    }
    if (!inGuide) continue;
    if (tag === "p" || tag === "ul" || tag === "ol" || tag === "dl") {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      if (text) paragraphs.push(text);
    }
  }
  return paragraphs.join("\n\n");
}

/** Best real URL for a lazy-loaded fandom `<img>` - fandom often serves a 1x1 placeholder in `src`, with the real URL in `data-src`/`srcset`/the parent anchor. */
function realImageSrc(img: Element, figure: Element): string {
  const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset") ?? "";
  const fromSrcset = srcset
    ? ((
        srcset
          .split(",")
          .map((entry) => entry.trim())
          .pop() ?? ""
      ).split(/\s+/)[0] ?? "")
    : "";
  const anchorHref = figure.querySelector("a")?.getAttribute("href") ?? "";
  const candidates = [
    img.getAttribute("data-src"),
    img.getAttribute("data-image-src"),
    fromSrcset,
    img.getAttribute("src"),
    anchorHref,
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith("data:") || !/^https?:/i.test(candidate)) continue;
    return candidate;
  }
  return "";
}

/** Full-res task screenshots (map thumbnails filtered out) - every location screenshot for the popup gallery, uncapped. */
export async function fetchWikiImages(slug: string): Promise<readonly WikiImage[]> {
  if (!slug) return [];
  const doc = await fetchWikiDoc(slug).catch(() => null);
  if (!doc) return [];
  const out: WikiImage[] = [];
  const seen = new Set<string>();
  doc
    .querySelectorAll("figure.thumb, div.thumb, figure.pi-item, .gallery-item, .wikia-gallery-item")
    .forEach((figure) => {
      const img = figure.querySelector("img");
      if (!img) return;
      const caption = (
        figure.querySelector(".caption, figcaption, .thumbcaption, .gallerytext")?.textContent ?? ""
      ).trim();
      if (/\bmap\b/i.test(caption)) return;
      let src = realImageSrc(img, figure);
      if (!src) return;
      src = src
        .replace(/\/scale-to-width-down\/\d+/, "")
        .replace(/\/scale-to-height-down\/\d+/, "")
        .replace(/\/smart\/width\/\d+\/height\/\d+/, "")
        .replace(/\/thumb\//, "/");
      if (seen.has(src)) return;
      seen.add(src);
      out.push({ url: src, caption });
    });
  return out;
}
